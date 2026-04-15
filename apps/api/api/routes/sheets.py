from __future__ import annotations

"""
Google Sheets API routes — OAuth flow, spreadsheet listing, import, and CSV upload.

Two modes:
1. OAuth: User connects Google account → picks spreadsheet → CueBI imports it
2. CSV Upload: User exports sheet as CSV → uploads to CueBI (no OAuth needed)

Mode 2 is the simpler path for Indian users who may be uncomfortable with OAuth.
"""
import os
import asyncpg
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from packages.connectors.google_sheets import (
    fetch_spreadsheet_data, parse_sheets_from_csv,
    create_sheets_staging, build_schema_from_sheets,
)
from packages.core.chunker import schema_to_chunks
from packages.core.embedder import store_chunks

router = APIRouter()

DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"
STAGING_DB_URL = os.getenv("SYNC_DATABASE_URL", "postgresql://cuebi:cuebi_dev@postgres:5432/cuebi")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/sheets/oauth/callback")


@router.get("/oauth/url")
async def get_oauth_url():
    """Get the Google OAuth URL to start the consent flow."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env. "
                   "Alternatively, use POST /api/sheets/upload-csv to upload a CSV export.",
        )

    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI

    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    return {"auth_url": auth_url, "state": state}


@router.get("/oauth/callback")
async def oauth_callback(code: str = Query(...), state: str = Query(default="")):
    """Handle Google OAuth callback — exchange code for tokens."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth not configured.")

    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    flow.fetch_token(code=code)

    credentials = flow.credentials
    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "message": "Google account connected! Use POST /api/sheets/import with the access_token and spreadsheet_id.",
    }


class SheetsImportRequest(BaseModel):
    spreadsheet_id: str
    access_token: str
    refresh_token: str = ""
    name: str = "Google Sheets Import"


@router.post("/import")
async def import_spreadsheet(req: SheetsImportRequest):
    """
    Import a Google Spreadsheet. Each sheet tab becomes a queryable table.
    Requires OAuth access_token from the /oauth flow.
    """
    try:
        sheets_data = await fetch_spreadsheet_data(
            credentials={
                "access_token": req.access_token,
                "refresh_token": req.refresh_token,
            },
            spreadsheet_id=req.spreadsheet_id,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch spreadsheet: {str(e)}")

    if not sheets_data.tabs:
        raise HTTPException(status_code=400, detail="No data found in the spreadsheet. Make sure sheets have headers in row 1 and data in rows below.")

    return await _stage_and_embed(sheets_data, req.name, f"sheets:{req.spreadsheet_id}")


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    name: str = Form("CSV Import"),
    sheet_name: str = Form("sheet1"),
):  
    """
    Upload a CSV file exported from Google Sheets (or any CSV).
    This is the no-OAuth path — simpler for Indian SMB users.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            csv_text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to read file encoding. Save as UTF-8 CSV.")

    sheets_data = parse_sheets_from_csv(csv_text, sheet_name=sheet_name)

    if not sheets_data.tabs or not sheets_data.tabs[0].rows:
        raise HTTPException(status_code=400, detail="No data found in CSV. Make sure row 1 has column headers.")

    return await _stage_and_embed(sheets_data, name, f"csv:{file.filename}")


async def _stage_and_embed(sheets_data, name: str, source_ref: str) -> dict:
    """Shared logic: create staging tables + embed schema + return connection."""

    # Create connection record
    async with async_session() as db:
        result = await db.execute(
            text("""
                INSERT INTO connections (org_id, name, conn_type, host, port, database_name, username, password_enc, status, extra_config)
                VALUES (:org_id, :name, 'google_sheets', 'localhost', 5432, 'cuebi', 'cuebi', 'cuebi_dev', 'syncing',
                        :config::jsonb)
                RETURNING id
            """),
            {
                "org_id": DEV_ORG_ID,
                "name": name,
                "config": '{"source": "' + source_ref + '", "title": "' + (sheets_data.spreadsheet_title or name) + '"}',
            },
        )
        await db.commit()
        connection_id = str(result.scalars().first())

    # Create staging tables
    try:
        pool = await asyncpg.create_pool(STAGING_DB_URL, min_size=1, max_size=3)
        counts = await create_sheets_staging(pool, sheets_data)
        await pool.close()
    except Exception as e:
        async with async_session() as db:
            await db.execute(text("UPDATE connections SET status = 'error' WHERE id = :id"), {"id": connection_id})
            await db.commit()
        raise HTTPException(status_code=500, detail=f"Staging error: {str(e)}")

    # Build schema and embed
    schema_info = build_schema_from_sheets(sheets_data, counts)

    try:
        chunks = schema_to_chunks(schema_info)
        point_ids = await store_chunks(connection_id, chunks)
        vectors_stored = len(point_ids)

        async with async_session() as db:
            for table in schema_info.tables:
                for col in table.columns:
                    await db.execute(
                        text("""
                            INSERT INTO schema_metadata (connection_id, table_name, column_name, data_type, description, is_primary_key, foreign_key)
                            VALUES (:cid, :table, :col, :dtype, :desc, :pk, :fk)
                        """),
                        {
                            "cid": connection_id, "table": table.name,
                            "col": col.name, "dtype": col.data_type,
                            "desc": col.description,
                            "pk": col.is_primary_key,
                            "fk": f"{col.references_table}.{col.references_column}" if col.is_foreign_key else None,
                        },
                    )
            await db.execute(
                text("UPDATE connections SET status = 'ready', last_synced_at = NOW() WHERE id = :id"),
                {"id": connection_id},
            )
            await db.commit()
    except Exception as e:
        async with async_session() as db:
            await db.execute(text("UPDATE connections SET status = 'error' WHERE id = :id"), {"id": connection_id})
            await db.commit()
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")

    tab_summary = {tab.name: tab.row_count for tab in sheets_data.tabs}

    return {
        "connection_id": connection_id,
        "status": "ready",
        "spreadsheet_title": sheets_data.spreadsheet_title,
        "tabs_imported": tab_summary,
        "staging_tables": counts,
        "vectors_stored": vectors_stored,
        "message": f"Google Sheets data imported! {len(sheets_data.tabs)} tab(s) are now queryable.",
    }