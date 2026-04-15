from __future__ import annotations

"""
Tally Staging — takes parsed TallyData and creates queryable PostgreSQL
staging tables. These tables then go through the normal CueBI
embedding pipeline so users can query their Tally data with natural language.
"""
import asyncpg
from typing import Any
from .parser import TallyData


VOUCHER_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS {schema}.tally_vouchers (
    id SERIAL PRIMARY KEY,
    date DATE,
    voucher_type VARCHAR(50),
    voucher_number VARCHAR(50),
    party_name VARCHAR(200),
    amount NUMERIC(15,2),
    narration TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
"""

VOUCHER_ENTRIES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS {schema}.tally_voucher_entries (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER,
    ledger_name VARCHAR(200),
    amount NUMERIC(15,2),
    is_debit BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);
"""

LEDGER_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS {schema}.tally_ledgers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    parent_group VARCHAR(100),
    opening_balance NUMERIC(15,2) DEFAULT 0,
    closing_balance NUMERIC(15,2) DEFAULT 0,
    gstin VARCHAR(15),
    address TEXT,
    state VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
"""

STOCK_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS {schema}.tally_stock_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    parent_group VARCHAR(100),
    unit VARCHAR(20),
    opening_qty NUMERIC(12,3) DEFAULT 0,
    opening_value NUMERIC(15,2) DEFAULT 0,
    closing_qty NUMERIC(12,3) DEFAULT 0,
    closing_value NUMERIC(15,2) DEFAULT 0,
    hsn_code VARCHAR(10),
    gst_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
"""


async def create_tally_staging(
    pool: asyncpg.Pool,
    data: TallyData,
    schema: str = "public",
) -> dict[str, int]:
    """
    Create staging tables and insert parsed Tally data.
    Returns counts of rows inserted per table.
    """
    counts = {}

    async with pool.acquire() as conn:
        # Create tables
        await conn.execute(VOUCHER_TABLE_SQL.format(schema=schema))
        await conn.execute(VOUCHER_ENTRIES_TABLE_SQL.format(schema=schema))
        await conn.execute(LEDGER_TABLE_SQL.format(schema=schema))
        await conn.execute(STOCK_TABLE_SQL.format(schema=schema))

        # Clear existing data (re-import)
        await conn.execute(f"TRUNCATE {schema}.tally_vouchers, {schema}.tally_voucher_entries, {schema}.tally_ledgers, {schema}.tally_stock_items RESTART IDENTITY")

        # Insert vouchers
        if data.vouchers:
            voucher_rows = []
            entry_rows = []
            for i, v in enumerate(data.vouchers, 1):
                voucher_rows.append((
                    _parse_tally_date(v.date), v.voucher_type, v.voucher_number,
                    v.party_name, v.amount, v.narration,
                ))
                for e in v.ledger_entries:
                    entry_rows.append((i, e["ledger_name"], e["amount"], e["is_debit"]))

            await conn.executemany(
                f"INSERT INTO {schema}.tally_vouchers (date, voucher_type, voucher_number, party_name, amount, narration) VALUES ($1, $2, $3, $4, $5, $6)",
                voucher_rows,
            )
            if entry_rows:
                await conn.executemany(
                    f"INSERT INTO {schema}.tally_voucher_entries (voucher_id, ledger_name, amount, is_debit) VALUES ($1, $2, $3, $4)",
                    entry_rows,
                )
            counts["tally_vouchers"] = len(voucher_rows)
            counts["tally_voucher_entries"] = len(entry_rows)

        # Insert ledgers
        if data.ledgers:
            ledger_rows = [(
                l.name, l.parent_group, l.opening_balance, l.closing_balance,
                l.gstin, l.address, l.state,
            ) for l in data.ledgers]
            await conn.executemany(
                f"INSERT INTO {schema}.tally_ledgers (name, parent_group, opening_balance, closing_balance, gstin, address, state) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                ledger_rows,
            )
            counts["tally_ledgers"] = len(ledger_rows)

        # Insert stock items
        if data.stock_items:
            stock_rows = [(
                s.name, s.parent_group, s.unit, s.opening_qty, s.opening_value,
                s.closing_qty, s.closing_value, s.hsn_code, s.gst_rate,
            ) for s in data.stock_items]
            await conn.executemany(
                f"INSERT INTO {schema}.tally_stock_items (name, parent_group, unit, opening_qty, opening_value, closing_qty, closing_value, hsn_code, gst_rate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                stock_rows,
            )
            counts["tally_stock_items"] = len(stock_rows)

        # Handle raw Excel tables (generic sheets that weren't auto-detected)
        for table_name, rows in data.raw_tables.items():
            if not rows:
                continue
            # Check if we already parsed this as vouchers/ledgers/stock
            if table_name in ("tally_day_book", "tally_trial_balance", "tally_stock_summary"):
                continue

            # Create dynamic table from Excel columns
            columns = list(rows[0].keys())
            if not columns:
                continue

            col_defs = ", ".join(
                f'"{_sanitize_col(c)}" TEXT' for c in columns
            )
            await conn.execute(
                f'DROP TABLE IF EXISTS {schema}."{table_name}"'
            )
            await conn.execute(
                f'CREATE TABLE {schema}."{table_name}" (id SERIAL PRIMARY KEY, {col_defs})'
            )

            # Insert rows
            placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))
            col_names = ", ".join(f'"{_sanitize_col(c)}"' for c in columns)
            insert_rows = [
                tuple(str(row.get(c, "")) for c in columns)
                for row in rows
            ]
            if insert_rows:
                await conn.executemany(
                    f'INSERT INTO {schema}."{table_name}" ({col_names}) VALUES ({placeholders})',
                    insert_rows,
                )
            counts[table_name] = len(insert_rows)

    return counts


def _parse_tally_date(date_str: str) -> str | None:
    """Parse Tally date formats: YYYYMMDD, DD-MM-YYYY, DD/MM/YYYY, etc."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # YYYYMMDD (Tally XML native format)
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

    # DD-MM-YYYY or DD/MM/YYYY
    for sep in ("-", "/"):
        parts = date_str.split(sep)
        if len(parts) == 3:
            d, m, y = parts
            if len(y) == 4 and len(d) <= 2:
                return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
            if len(d) == 4 and len(y) <= 2:  # YYYY-MM-DD already
                return date_str

    return date_str  # Return as-is, let PostgreSQL try


def _sanitize_col(name: str) -> str:
    """Sanitize column name for SQL."""
    import re
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name.strip().lower())
    name = re.sub(r'_+', '_', name).strip('_')
    return name or "col"