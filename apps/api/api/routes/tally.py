from __future__ import annotations

"""Tally Upload API — upload Tally XML or Excel, auto-parse and create staging tables."""
import os
import asyncpg
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlalchemy import text

from apps.api.api.db import async_session
from packages.connectors.tally import parse_tally_xml, parse_tally_excel, create_tally_staging, TallyData
from packages.connectors.base import SchemaInfo, TableInfo, ColumnInfo
from packages.core.chunker import schema_to_chunks
from packages.core.embedder import store_chunks

router = APIRouter()

DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"

# Tally staging uses the app's own Postgres (demo-db is for SQL connectors)
STAGING_DB_URL = os.getenv("SYNC_DATABASE_URL", "postgresql://cuebi:cuebi_dev@postgres:5432/cuebi")


@router.post("/upload")
async def upload_tally_file(
    file: UploadFile = File(...),
    name: str = Form("Tally Import"),
):
    """
    Upload a Tally XML or Excel file.
    CueBI auto-parses it, creates staging tables, and runs the embedding pipeline.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    filename = file.filename.lower()
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Parse based on file type
    try:
        if filename.endswith(".xml"):
            tally_data = parse_tally_xml(content)
        elif filename.endswith((".xlsx", ".xls")):
            tally_data = parse_tally_excel(content, filename)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {filename}. Upload .xml or .xlsx from Tally.",
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Tally file: {str(e)}")

    # Summary of what was parsed
    parsed_summary = {
        "company": tally_data.company_name,
        "vouchers": len(tally_data.vouchers),
        "ledgers": len(tally_data.ledgers),
        "stock_items": len(tally_data.stock_items),
        "raw_tables": list(tally_data.raw_tables.keys()),
    }

    if parsed_summary["vouchers"] == 0 and parsed_summary["ledgers"] == 0 and \
       parsed_summary["stock_items"] == 0 and not parsed_summary["raw_tables"]:
        raise HTTPException(
            status_code=400,
            detail="No data found in the file. Make sure you export from Tally using Alt+E → XML (Data Interchange) or Excel format.",
        )

    # Create a connection record
    async with async_session() as db:
        result = await db.execute(
            text("""
                INSERT INTO connections (org_id, name, conn_type, host, port, database_name, username, password_enc, status, extra_config)
                VALUES (:org_id, :name, 'tally', 'localhost', 5432, 'cuebi', 'cuebi', 'cuebi_dev', 'syncing',
                        :config::jsonb)
                RETURNING id
            """),
            {
                "org_id": DEV_ORG_ID,
                "name": name,
                "config": '{"source_file": "' + (file.filename or "unknown") + '", "company": "' + tally_data.company_name + '"}',
            },
        )
        await db.commit()
        connection_id = str(result.scalars().first())

    # Create staging tables in PostgreSQL
    try:
        pool = await asyncpg.create_pool(STAGING_DB_URL, min_size=1, max_size=3)
        counts = await create_tally_staging(pool, tally_data, schema="public")
        await pool.close()
    except Exception as e:
        async with async_session() as db:
            await db.execute(
                text("UPDATE connections SET status = 'error' WHERE id = :id"),
                {"id": connection_id},
            )
            await db.commit()
        raise HTTPException(status_code=500, detail=f"Staging error: {str(e)}")

    # Build schema info from staging tables for embedding
    schema_info = _build_schema_from_tally(tally_data, counts)

    # Run embedding pipeline
    try:
        chunks = schema_to_chunks(schema_info)
        point_ids = await store_chunks(connection_id, chunks)
        vectors_stored = len(point_ids)

        # Store metadata
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
            await db.execute(
                text("UPDATE connections SET status = 'error' WHERE id = :id"),
                {"id": connection_id},
            )
            await db.commit()
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")

    return {
        "connection_id": connection_id,
        "status": "ready",
        "parsed": parsed_summary,
        "staging_tables": counts,
        "vectors_stored": vectors_stored,
        "message": f"Tally data imported successfully! You can now ask questions about your {tally_data.company_name or 'Tally'} data.",
    }


def _build_schema_from_tally(data: TallyData, counts: dict) -> SchemaInfo:
    """Build SchemaInfo from Tally staging tables for the embedding pipeline."""
    tables = []

    if counts.get("tally_vouchers", 0) > 0:
        tables.append(TableInfo(
            name="tally_vouchers",
            description="Tally voucher transactions (sales, purchases, payments, receipts, journals)",
            row_count=counts["tally_vouchers"],
            columns=[
                ColumnInfo(name="date", data_type="date", description="Transaction date"),
                ColumnInfo(name="voucher_type", data_type="varchar", description="Type: Sales, Purchase, Payment, Receipt, Journal, Contra"),
                ColumnInfo(name="voucher_number", data_type="varchar", description="Tally voucher number"),
                ColumnInfo(name="party_name", data_type="varchar", description="Customer or supplier name (party ledger)"),
                ColumnInfo(name="amount", data_type="numeric", description="Transaction amount in INR"),
                ColumnInfo(name="narration", data_type="text", description="Transaction narration/description"),
            ],
        ))

    if counts.get("tally_voucher_entries", 0) > 0:
        tables.append(TableInfo(
            name="tally_voucher_entries",
            description="Individual debit/credit entries within each Tally voucher",
            row_count=counts["tally_voucher_entries"],
            columns=[
                ColumnInfo(name="voucher_id", data_type="integer", description="Links to tally_vouchers.id",
                           is_foreign_key=True, references_table="tally_vouchers", references_column="id"),
                ColumnInfo(name="ledger_name", data_type="varchar", description="Accounting ledger head (e.g. Sales A/c, Cash A/c, Bank A/c)"),
                ColumnInfo(name="amount", data_type="numeric", description="Entry amount in INR (positive=debit, negative=credit)"),
                ColumnInfo(name="is_debit", data_type="boolean", description="True if debit entry, False if credit"),
            ],
        ))

    if counts.get("tally_ledgers", 0) > 0:
        tables.append(TableInfo(
            name="tally_ledgers",
            description="Tally ledger accounts (chart of accounts) with opening/closing balances",
            row_count=counts["tally_ledgers"],
            columns=[
                ColumnInfo(name="name", data_type="varchar", description="Ledger account name"),
                ColumnInfo(name="parent_group", data_type="varchar", description="Parent group (Sundry Debtors, Sundry Creditors, Bank Accounts, etc.)"),
                ColumnInfo(name="opening_balance", data_type="numeric", description="Opening balance in INR"),
                ColumnInfo(name="closing_balance", data_type="numeric", description="Closing balance in INR"),
                ColumnInfo(name="gstin", data_type="varchar", description="GST Identification Number of the party"),
                ColumnInfo(name="state", data_type="varchar", description="State of the party"),
            ],
        ))

    if counts.get("tally_stock_items", 0) > 0:
        tables.append(TableInfo(
            name="tally_stock_items",
            description="Tally inventory/stock items with quantities and HSN codes",
            row_count=counts["tally_stock_items"],
            columns=[
                ColumnInfo(name="name", data_type="varchar", description="Stock item name"),
                ColumnInfo(name="parent_group", data_type="varchar", description="Stock group"),
                ColumnInfo(name="unit", data_type="varchar", description="Unit of measurement (Nos, Kg, Pcs, etc.)"),
                ColumnInfo(name="closing_qty", data_type="numeric", description="Closing stock quantity"),
                ColumnInfo(name="closing_value", data_type="numeric", description="Closing stock value in INR"),
                ColumnInfo(name="hsn_code", data_type="varchar", description="HSN code for GST classification"),
                ColumnInfo(name="gst_rate", data_type="numeric", description="GST rate percentage"),
            ],
        ))

    # Dynamic tables from Excel sheets
    for table_name, rows in data.raw_tables.items():
        if table_name in ("tally_day_book", "tally_trial_balance", "tally_stock_summary"):
            continue
        if rows:
            cols = [
                ColumnInfo(name=k.lower().replace(" ", "_"), data_type="text", description=k)
                for k in rows[0].keys()
            ]
            tables.append(TableInfo(
                name=table_name, description=f"Tally Excel data: {table_name}",
                row_count=len(rows), columns=cols,
            ))

    return SchemaInfo(tables=tables, dialect="postgresql", database_name="cuebi")