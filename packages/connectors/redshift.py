from __future__ import annotations
"""
CueBI — Amazon Redshift Connector
Connects to an Amazon Redshift cluster or Redshift Serverless endpoint.

Redshift uses the PostgreSQL wire protocol (asyncpg compatible).
Key differences from standard PostgreSQL:
- Default port: 5439
- SSL required by default
- Schema introspection uses pg_catalog (not information_schema)
- SVV_TABLE_INFO for row counts (faster than pg_class for large clusters)
"""

import asyncpg
from typing import Any, Optional
from .base import BaseConnector, SchemaInfo, TableInfo, ColumnInfo


class RedshiftConnector(BaseConnector):
    """
    Amazon Redshift connector using asyncpg (PostgreSQL wire protocol).
    Works with both provisioned clusters and Redshift Serverless.

    Connection string format:
      redshift-cluster.abc123.us-east-1.redshift.amazonaws.com:5439/dev
    """

    def __init__(
        self,
        host: str,
        port: int = 5439,
        database: str = "dev",
        username: str = "",
        password: str = "",
        ssl: bool = True,
    ):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.ssl = ssl
        self._pool: Optional[asyncpg.Pool] = None

    @property
    def connector_type(self) -> str:
        return "redshift"

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            ssl_param = "require" if self.ssl else None
            self._pool = await asyncpg.create_pool(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.username,
                password=self.password,
                ssl=ssl_param,
                min_size=1,
                max_size=5,
                command_timeout=60,
                server_settings={"search_path": "public"},
            )
        return self._pool

    # ── Test connection ───────────────────────────────────────

    async def test_connection(self) -> tuple[bool, str]:
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                version = await conn.fetchval("SELECT version()")
            return True, f"Connected ✓  Redshift {version.split(',')[0] if version else ''}"
        except Exception as e:
            return False, str(e)

    # ── Schema extraction ─────────────────────────────────────

    async def extract_schema(self) -> SchemaInfo:
        """
        Extracts schema from Redshift's information_schema.
        Uses SVV_TABLE_INFO for accurate row counts.
        """
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            tables = await self._get_tables(conn)
            for table in tables:
                table.columns = await self._get_columns(conn, table.name)
                table.row_count = await self._get_row_count(conn, table.name)
                await self._add_sample_values(conn, table)

        return SchemaInfo(
            tables=tables,
            dialect="postgresql",  # Redshift is SQL-compatible with PostgreSQL
            database_name=self.database,
        )

    async def _get_tables(self, conn: asyncpg.Connection) -> list[TableInfo]:
        rows = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        return [TableInfo(name=row["table_name"]) for row in rows]

    async def _get_columns(self, conn: asyncpg.Connection, table_name: str) -> list[ColumnInfo]:
        col_rows = await conn.fetch("""
            SELECT
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = $1
            ORDER BY ordinal_position
        """, table_name)

        # Redshift PKs via pg_constraint
        pk_rows = await conn.fetch("""
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name      = $1
              AND tc.table_schema    = 'public'
        """, table_name)
        pk_cols = {r["column_name"] for r in pk_rows}

        columns = []
        for row in col_rows:
            col_name = row["column_name"]
            columns.append(ColumnInfo(
                name=col_name,
                data_type=row["data_type"],
                is_nullable=(row["is_nullable"] == "YES"),
                is_primary_key=(col_name in pk_cols),
            ))
        return columns

    async def _get_row_count(self, conn: asyncpg.Connection, table_name: str) -> int:
        """Use SVV_TABLE_INFO for accurate Redshift row counts."""
        try:
            row = await conn.fetchrow("""
                SELECT tbl_rows
                FROM svv_table_info
                WHERE "table" = $1
                  AND "schema" = 'public'
            """, table_name)
            return int(row["tbl_rows"]) if row and row["tbl_rows"] else 0
        except Exception:
            return 0

    async def _add_sample_values(self, conn: asyncpg.Connection, table: TableInfo) -> None:
        sensitive_keywords = {"password", "secret", "token", "key", "hash", "salt", "otp"}
        for col in table.columns:
            if any(kw in col.name.lower() for kw in sensitive_keywords):
                col.sample_values = ["[REDACTED]"]
                continue
            try:
                rows = await conn.fetch(f"""
                    SELECT DISTINCT "{col.name}"::VARCHAR AS val
                    FROM "{table.name}"
                    WHERE "{col.name}" IS NOT NULL
                    LIMIT 3
                """)
                col.sample_values = [r["val"] for r in rows]
            except Exception:
                col.sample_values = []

    # ── Query execution ───────────────────────────────────────

    async def execute_query(self, sql: str, limit: int = 1000) -> tuple[list[str], list[list[Any]]]:
        sql_upper = sql.upper().strip()
        if sql_upper.startswith("SELECT") and "LIMIT" not in sql_upper:
            sql = sql.rstrip(";") + f" LIMIT {limit}"

        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql)
            if not rows:
                return [], []
            columns = list(rows[0].keys())
            data = [list(row.values()) for row in rows]
            return columns, data

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
