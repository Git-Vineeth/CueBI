from __future__ import annotations

"""
CueBI — Schema API
Endpoints to browse and edit the semantic schema (LLM-generated descriptions).
"""


"""Schema API — browse and edit schema metadata for a connection."""
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session

router = APIRouter()


@router.get("/{connection_id}")
async def get_schema(connection_id: UUID):
    """Get all tables and columns for a connection."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT table_name, column_name, data_type, description,
                       is_primary_key, foreign_key,
                       dbt_model_schema, lineage, source
                FROM schema_metadata
                WHERE connection_id = :cid
                ORDER BY table_name, column_name
            """),
            {"cid": str(connection_id)},
        )
        rows = result.mappings().all()
        if not rows:
            raise HTTPException(status_code=404, detail="No schema found. Sync the connection first.")

        # Group by table — carry dbt_model_schema and lineage at table level
        tables = {}
        for r in rows:
            tn = r["table_name"]
            if tn not in tables:
                dbt_schema = r["dbt_model_schema"] or ""
                tables[tn] = {
                    "table_name": tn,
                    "sql_name": f"{dbt_schema}.{tn}" if dbt_schema else tn,
                    "dbt_schema": dbt_schema,
                    "source": r["source"] or "introspection",
                    "lineage": r["lineage"] or [],
                    "columns": [],
                }
            tables[tn]["columns"].append({
                "column_name": r["column_name"],
                "data_type": r["data_type"],
                "description": r["description"] or "",
                "is_primary_key": r["is_primary_key"],
                "foreign_key": r["foreign_key"],
            })

        return list(tables.values())


class DescriptionUpdate(BaseModel):
    description: str


@router.patch("/{connection_id}/{table_name}/{column_name}")
async def update_column_description(connection_id: UUID, table_name: str, column_name: str, body: DescriptionUpdate):
    """Update the description for a specific column (admin edits semantic layer)."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                UPDATE schema_metadata SET description = :desc
                WHERE connection_id = :cid AND table_name = :table AND column_name = :col
            """),
            {"desc": body.description, "cid": str(connection_id), "table": table_name, "col": column_name},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Column not found")
        return {"status": "updated", "table": table_name, "column": column_name, "description": body.description}