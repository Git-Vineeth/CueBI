from __future__ import annotations

"""
CueBI — dbt Integration API

Two paths to load dbt metadata into CueBI:
  1. manifest upload  — POST /{id}/dbt/manifest  (file upload)
  2. dbt Cloud sync   — POST /{id}/dbt/cloud      (save credentials)
                        POST /{id}/dbt/sync        (trigger fetch)

Both paths parse manifest.json → update schema_metadata + re-embed Qdrant.
Introspection data (sample values, row counts) is preserved; dbt wins on
descriptions, PKs, FKs, and schema-qualified names.
"""

import json
from uuid import UUID

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from packages.core.chunker import schema_to_chunks
from packages.core.dbt_parser import get_manifest_stats, parse_manifest
from packages.core.embedder import store_chunks

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class DbtCloudConfig(BaseModel):
    account_id: str
    project_id: str
    environment_id: str = ""
    api_token: str


# ── Core processing ───────────────────────────────────────────────────────────

async def _process_manifest(connection_id: str, manifest_data: dict) -> dict:
    """
    Parse manifest.json, rebuild Qdrant vectors, upsert schema_metadata.

    Overlay strategy:
    - If a column exists from introspection, UPDATE it with dbt descriptions/PKs/FKs.
    - If a column is dbt-only (model not yet in Redshift), INSERT it.
    - Introspected sample_values and row_counts are preserved (manifest has none).
    """
    schema_info = parse_manifest(manifest_data)
    stats = get_manifest_stats(manifest_data)

    if not schema_info.tables:
        raise ValueError("No models found in manifest.json. Is this a valid dbt manifest?")

    # Rebuild Qdrant vectors for this connection (replaces old introspection vectors)
    chunks = schema_to_chunks(schema_info)
    await store_chunks(connection_id, chunks)

    # Upsert schema_metadata rows
    async with async_session() as db:
        for table in schema_info.tables:
            for col in table.columns:
                fk_str = (
                    f"{col.references_table}.{col.references_column}"
                    if col.is_foreign_key else None
                )
                await db.execute(
                    text("""
                        INSERT INTO schema_metadata
                            (connection_id, table_name, column_name, data_type,
                             description, is_primary_key, foreign_key,
                             dbt_model_schema, lineage, source)
                        VALUES
                            (:cid, :table, :col, :dtype,
                             :desc, :pk, :fk,
                             :dbt_schema, CAST(:lineage AS jsonb), 'dbt')
                        ON CONFLICT (connection_id, table_name, column_name)
                        DO UPDATE SET
                            description      = EXCLUDED.description,
                            is_primary_key   = EXCLUDED.is_primary_key,
                            foreign_key      = EXCLUDED.foreign_key,
                            dbt_model_schema = EXCLUDED.dbt_model_schema,
                            lineage          = EXCLUDED.lineage,
                            source           = 'dbt'
                    """),
                    {
                        "cid": connection_id,
                        "table": table.name,
                        "col": col.name,
                        "dtype": col.data_type,
                        "desc": col.description or "",
                        "pk": col.is_primary_key,
                        "fk": fk_str,
                        "dbt_schema": table.dbt_schema or "",
                        "lineage": json.dumps(table.lineage),
                    },
                )
        await db.commit()

    return stats


# ── Manifest upload ───────────────────────────────────────────────────────────

@router.post("/{connection_id}/dbt/manifest")
async def upload_manifest(connection_id: UUID, file: UploadFile = File(...)):
    """
    Upload a dbt manifest.json to enrich schema metadata.

    Run `dbt compile` or `dbt run` locally and upload target/manifest.json.
    Re-upload any time your dbt models change.
    """
    async with async_session() as db:
        row = (await db.execute(
            text("SELECT id FROM connections WHERE id = :id"),
            {"id": str(connection_id)},
        )).scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

    try:
        content = await file.read()
        manifest_data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    if "nodes" not in manifest_data:
        raise HTTPException(
            status_code=400,
            detail="Not a valid dbt manifest.json — missing 'nodes' key. "
                   "Generate it with `dbt compile` or `dbt run`.",
        )

    try:
        stats = await _process_manifest(str(connection_id), manifest_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

    # Persist dbt_configs row
    async with async_session() as db:
        await db.execute(
            text("""
                INSERT INTO dbt_configs
                    (connection_id, dbt_type, model_count, sync_status, last_synced_at, updated_at)
                VALUES (:cid, 'manifest', :count, 'ready', NOW(), NOW())
                ON CONFLICT (connection_id) DO UPDATE SET
                    dbt_type       = 'manifest',
                    model_count    = EXCLUDED.model_count,
                    sync_status    = 'ready',
                    last_synced_at = NOW(),
                    updated_at     = NOW(),
                    sync_error     = NULL
            """),
            {"cid": str(connection_id), "count": stats["model_count"]},
        )
        await db.commit()

    return {
        "status": "ok",
        "models": stats["model_count"],
        "columns": stats["column_count"],
        "documented_columns": stats["documented_column_count"],
        "tests": stats["test_count"],
    }


# ── dbt Cloud ─────────────────────────────────────────────────────────────────

@router.post("/{connection_id}/dbt/cloud")
async def configure_dbt_cloud(connection_id: UUID, req: DbtCloudConfig):
    """Save dbt Cloud credentials and trigger an immediate sync."""
    async with async_session() as db:
        row = (await db.execute(
            text("SELECT id FROM connections WHERE id = :id"),
            {"id": str(connection_id)},
        )).scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        await db.execute(
            text("""
                INSERT INTO dbt_configs
                    (connection_id, dbt_type, account_id, project_id, environment_id,
                     api_token_enc, sync_status, updated_at)
                VALUES (:cid, 'cloud', :acct, :proj, :env, :token, 'pending', NOW())
                ON CONFLICT (connection_id) DO UPDATE SET
                    dbt_type       = 'cloud',
                    account_id     = EXCLUDED.account_id,
                    project_id     = EXCLUDED.project_id,
                    environment_id = EXCLUDED.environment_id,
                    api_token_enc  = EXCLUDED.api_token_enc,
                    sync_status    = 'pending',
                    updated_at     = NOW()
            """),
            {
                "cid": str(connection_id),
                "acct": req.account_id,
                "proj": req.project_id,
                "env": req.environment_id,
                "token": req.api_token,  # TODO: encrypt with Fernet before storing
            },
        )
        await db.commit()

    # Trigger first sync immediately
    return await sync_from_dbt_cloud(connection_id)


@router.post("/{connection_id}/dbt/sync")
async def sync_from_dbt_cloud(connection_id: UUID):
    """Fetch the latest manifest from dbt Cloud and refresh semantic metadata."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT account_id, project_id, environment_id, api_token_enc
                FROM dbt_configs
                WHERE connection_id = :cid AND dbt_type = 'cloud'
            """),
            {"cid": str(connection_id)},
        )
        config = result.mappings().first()

    if not config:
        raise HTTPException(
            status_code=404,
            detail="No dbt Cloud config found for this connection. "
                   "Configure it first via POST /dbt/cloud.",
        )

    # Mark syncing
    async with async_session() as db:
        await db.execute(
            text("UPDATE dbt_configs SET sync_status='syncing', updated_at=NOW() WHERE connection_id=:cid"),
            {"cid": str(connection_id)},
        )
        await db.commit()

    try:
        manifest_data = await _fetch_manifest_from_cloud(
            account_id=config["account_id"],
            project_id=config["project_id"],
            environment_id=config["environment_id"],
            api_token=config["api_token_enc"],
        )
        stats = await _process_manifest(str(connection_id), manifest_data)

        async with async_session() as db:
            await db.execute(
                text("""
                    UPDATE dbt_configs SET
                        sync_status    = 'ready',
                        model_count    = :count,
                        last_synced_at = NOW(),
                        sync_error     = NULL,
                        updated_at     = NOW()
                    WHERE connection_id = :cid
                """),
                {"cid": str(connection_id), "count": stats["model_count"]},
            )
            await db.commit()

        return {"status": "ok", "models": stats["model_count"]}

    except Exception as e:
        async with async_session() as db:
            await db.execute(
                text("""
                    UPDATE dbt_configs SET sync_status='error', sync_error=:err, updated_at=NOW()
                    WHERE connection_id=:cid
                """),
                {"cid": str(connection_id), "err": str(e)},
            )
            await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{connection_id}/dbt/status")
async def get_dbt_status(connection_id: UUID):
    """Get dbt sync status for a connection."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT dbt_type, sync_status, model_count, last_synced_at, sync_error
                FROM dbt_configs WHERE connection_id = :cid
            """),
            {"cid": str(connection_id)},
        )
        row = result.mappings().first()

    if not row:
        return {"configured": False}
    return {"configured": True, **dict(row)}


# ── dbt Cloud API fetcher ─────────────────────────────────────────────────────

async def _fetch_manifest_from_cloud(
    account_id: str,
    project_id: str,
    environment_id: str,
    api_token: str,
) -> dict:
    """
    Download manifest.json from dbt Cloud.

    Strategy:
    1. Try v3 environments endpoint (newer accounts, needs environment_id)
    2. Fall back to v2 runs endpoint (latest successful run)
    """
    headers = {"Authorization": f"Token {api_token}"}
    base = "https://cloud.getdbt.com/api"

    async with httpx.AsyncClient(timeout=30) as client:

        # ── v3: environments/latest endpoint ──────────────────────────────
        if environment_id:
            url = (
                f"{base}/v3/accounts/{account_id}/environments/"
                f"{environment_id}/dbt-artifacts/latest/?artifact=manifest.json"
            )
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass

        # ── v2: latest successful run ──────────────────────────────────────
        runs_url = f"{base}/v2/accounts/{account_id}/runs/?order_by=-finished_at&status=10&limit=1"
        if project_id:
            runs_url += f"&project_id={project_id}"

        runs_resp = await client.get(runs_url, headers=headers)
        if runs_resp.status_code == 401:
            raise Exception("dbt Cloud authentication failed — check your API token.")
        if runs_resp.status_code != 200:
            raise Exception(
                f"dbt Cloud API error {runs_resp.status_code}: {runs_resp.text[:300]}"
            )

        runs = runs_resp.json().get("data", [])
        if not runs:
            raise Exception(
                "No successful dbt runs found. Run `dbt compile` or `dbt run` "
                "in dbt Cloud first, then retry."
            )

        run_id = runs[0]["id"]
        artifact_url = f"{base}/v2/accounts/{account_id}/runs/{run_id}/artifacts/manifest.json"
        artifact_resp = await client.get(artifact_url, headers=headers)

        if artifact_resp.status_code != 200:
            raise Exception(
                f"Could not download manifest.json from run {run_id}: "
                f"{artifact_resp.status_code}"
            )

        return artifact_resp.json()
