from __future__ import annotations

"""
BharatBI — Connections API
Handles create, list, test, and sync of data source connections.
"""


"""Connections API — add, test, list, sync data source connections."""
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from packages.connectors import get_connector

router = APIRouter()

# Default org/user for local dev
DEV_ORG_ID = "00000000-0000-0000-0000-000000000001"
DEV_USER_ID = "00000000-0000-0000-0000-000000000002"


class ConnectionCreate(BaseModel):
    name: str
    conn_type: str  # postgresql, mysql
    host: str
    port: int
    database_name: str
    username: str
    password: str


class ConnectionTestRequest(BaseModel):
    conn_type: str
    host: str
    port: int
    database_name: str
    username: str
    password: str


@router.post("/test")
async def test_connection(req: ConnectionTestRequest):
    """Test if a database connection works before saving."""
    try:
        connector = get_connector(req.conn_type, {
            "host": req.host, "port": req.port,
            "username": req.username, "password": req.password,
            "database": req.database_name,
        })
        result = await connector.test_connection()
        await connector.close()
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("")
async def create_connection(req: ConnectionCreate):
    """Save a new data source connection."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                INSERT INTO connections (org_id, name, conn_type, host, port, database_name, username, password_enc, status)
                VALUES (:org_id, :name, :conn_type, :host, :port, :database_name, :username, :password, 'pending')
                RETURNING id, name, conn_type, status, created_at
            """),
            {
                "org_id": DEV_ORG_ID, "name": req.name, "conn_type": req.conn_type,
                "host": req.host, "port": req.port, "database_name": req.database_name,
                "username": req.username, "password": req.password,
            },
        )
        await db.commit()
        row = result.mappings().first()
        return dict(row)


@router.get("")
async def list_connections():
    """List all connections for the dev org."""
    async with async_session() as db:
        result = await db.execute(
            text("SELECT id, name, conn_type, host, port, database_name, status, last_synced_at, created_at FROM connections WHERE org_id = :org_id ORDER BY created_at DESC"),
            {"org_id": DEV_ORG_ID},
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]


@router.get("/{connection_id}")
async def get_connection(connection_id: UUID):
    async with async_session() as db:
        result = await db.execute(
            text("SELECT id, name, conn_type, host, port, database_name, status, last_synced_at FROM connections WHERE id = :id"),
            {"id": str(connection_id)},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")
        return dict(row)


@router.post("/{connection_id}/sync")
async def sync_connection(connection_id: UUID):
    """Trigger schema extraction + embedding pipeline for a connection."""
    async with async_session() as db:
        # Verify connection exists
        result = await db.execute(
            text("SELECT id, conn_type, host, port, database_name, username, password_enc FROM connections WHERE id = :id"),
            {"id": str(connection_id)},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        # Update status to syncing
        await db.execute(
            text("UPDATE connections SET status = 'syncing', updated_at = NOW() WHERE id = :id"),
            {"id": str(connection_id)},
        )
        await db.commit()

    # TODO: In production, dispatch this to Celery worker
    # For now, run inline for demo
    try:
        connector = get_connector(row["conn_type"], {
            "host": row["host"], "port": row["port"],
            "username": row["username"], "password": row["password_enc"],
            "database": row["database_name"],
        })
        schema_info = await connector.extract_schema()
        await connector.close()

        # Chunk and embed
        from packages.core.chunker import schema_to_chunks
        from packages.core.embedder import store_chunks

        chunks = schema_to_chunks(schema_info)
        point_ids = await store_chunks(str(connection_id), chunks)
        stored_count = len(point_ids)

        # Store schema metadata in DB
        async with async_session() as db:
            # Clear old metadata
            await db.execute(
                text("DELETE FROM schema_metadata WHERE connection_id = :cid"),
                {"cid": str(connection_id)},
            )
            for table in schema_info.tables:
                for col in table.columns:
                    await db.execute(
                        text("""
                            INSERT INTO schema_metadata (connection_id, table_name, column_name, data_type, is_primary_key, foreign_key)
                            VALUES (:cid, :table, :col, :dtype, :pk, :fk)
                        """),
                        {
                            "cid": str(connection_id), "table": table.name, "col": col.name,
                            "dtype": col.data_type, "pk": col.is_primary_key,
                            "fk": f"{col.references_table}.{col.references_column}" if col.is_foreign_key else None,
                        },
                    )
            await db.execute(
                text("UPDATE connections SET status = 'ready', last_synced_at = NOW(), updated_at = NOW() WHERE id = :id"),
                {"id": str(connection_id)},
            )
            await db.commit()

        return {
            "status": "ready",
            "tables": len(schema_info.tables),
            "columns": sum(len(t.columns) for t in schema_info.tables),
            "vectors_stored": stored_count,
        }
    except Exception as e:
        async with async_session() as db:
            await db.execute(
                text("UPDATE connections SET status = 'error', updated_at = NOW() WHERE id = :id"),
                {"id": str(connection_id)},
            )
            await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str):
    """Delete a connection and its schema metadata."""
    async with async_session() as db:
        result = await db.execute(
            text("SELECT id FROM connections WHERE id = :id AND org_id = :org"),
            {"id": connection_id, "org": DEV_ORG_ID},
        )
        if not result.scalars().first():
            raise HTTPException(status_code=404, detail="Connection not found")

        await db.execute(text("DELETE FROM schema_metadata WHERE connection_id = :id"), {"id": connection_id})
        await db.execute(text("DELETE FROM queries WHERE connection_id = :id"), {"id": connection_id})
        await db.execute(text("DELETE FROM connections WHERE id = :id"), {"id": connection_id})
        await db.commit()

    return {"deleted": True, "id": connection_id}