from __future__ import annotations
"""
CueBI — MySQL Connector
Connects to a user's MySQL/MariaDB database.
Uses aiomysql for async queries.
"""

import aiomysql
from typing import Any, Optional
from .base import BaseConnector, SchemaInfo, TableInfo, ColumnInfo


class MySQLConnector(BaseConnector):

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
    ):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self._pool: Optional[aiomysql.Pool] = None

    @property
    def connector_type(self) -> str:
        return "mysql"

    async def _get_pool(self) -> aiomysql.Pool:
        if self._pool is None:
            self._pool = await aiomysql.create_pool(
                host=self.host,
                port=self.port,
                db=self.database,
                user=self.username,
                password=self.password,
                minsize=1,
                maxsize=5,
                connect_timeout=10,
                autocommit=True,
            )
        return self._pool

    # ── Test connection ───────────────────────────────────────

    async def test_connection(self) -> tuple[bool, str]:
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT VERSION()")
                    (version,) = await cur.fetchone()
            return True, f"Connected ✓  MySQL {version}"
        except Exception as e:
            return False, str(e)

    # ── Schema extraction ─────────────────────────────────────

    async def extract_schema(self) -> SchemaInfo:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            tables = await self._get_tables(conn)
            for table in tables:
                table.columns = await self._get_columns(conn, table.name)
                table.row_count = await self._get_row_count(conn, table.name)
                await self._add_sample_values(conn, table)

        return SchemaInfo(
            tables=tables,
            dialect="mysql",
            database_name=self.database,
        )

    async def _get_tables(self, conn) -> list[TableInfo]:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT TABLE_NAME
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = %s
                  AND TABLE_TYPE   = 'BASE TABLE'
                ORDER BY TABLE_NAME
            """, (self.database,))
            rows = await cur.fetchall()
        return [TableInfo(name=r["TABLE_NAME"]) for r in rows]

    async def _get_columns(self, conn, table_name: str) -> list[ColumnInfo]:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_KEY,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.COLUMNS c
                LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
                    ON c.TABLE_SCHEMA  = kcu.TABLE_SCHEMA
                   AND c.TABLE_NAME   = kcu.TABLE_NAME
                   AND c.COLUMN_NAME  = kcu.COLUMN_NAME
                   AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
                WHERE c.TABLE_SCHEMA = %s
                  AND c.TABLE_NAME   = %s
                ORDER BY c.ORDINAL_POSITION
            """, (self.database, table_name))
            rows = await cur.fetchall()

        return [
            ColumnInfo(
                name=r["COLUMN_NAME"],
                data_type=r["DATA_TYPE"],
                is_nullable=(r["IS_NULLABLE"] == "YES"),
                is_primary_key=(r["COLUMN_KEY"] == "PRI"),
                is_foreign_key=(r["REFERENCED_TABLE_NAME"] is not None),
                references_table=r["REFERENCED_TABLE_NAME"],
                references_column=r["REFERENCED_COLUMN_NAME"],
            )
            for r in rows
        ]

    async def _get_row_count(self, conn, table_name: str) -> int:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT TABLE_ROWS
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            """, (self.database, table_name))
            row = await cur.fetchone()
        return int(row[0]) if row and row[0] else 0

    async def _add_sample_values(self, conn, table: TableInfo) -> None:
        sensitive_keywords = {"password", "secret", "token", "key", "hash", "salt", "otp"}
        for col in table.columns:
            if any(kw in col.name.lower() for kw in sensitive_keywords):
                col.sample_values = ["[REDACTED]"]
                continue
            try:
                async with conn.cursor() as cur:
                    await cur.execute(f"""
                        SELECT DISTINCT `{col.name}`
                        FROM `{table.name}`
                        WHERE `{col.name}` IS NOT NULL
                        LIMIT 3
                    """)
                    rows = await cur.fetchall()
                col.sample_values = [str(r[0]) for r in rows]
            except Exception:
                col.sample_values = []

    # ── Query execution ───────────────────────────────────────

    async def execute_query(self, sql: str, limit: int = 1000) -> tuple[list[str], list[list[Any]]]:
        sql_upper = sql.upper().strip()
        if sql_upper.startswith("SELECT") and "LIMIT" not in sql_upper:
            sql = sql.rstrip(";") + f" LIMIT {limit}"

        pool = await self._get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql)
                rows = await cur.fetchall()
                if not rows:
                    return [], []
                columns = list(rows[0].keys())
                data = [list(r.values()) for r in rows]
                return columns, data

    async def validate_sql(self, sql: str) -> tuple[bool, str]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                try:
                    await cur.execute(f"EXPLAIN {sql}")
                    return True, ""
                except aiomysql.Error as e:
                    return False, str(e)

    async def close(self) -> None:
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None