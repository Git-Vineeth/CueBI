from __future__ import annotations

"""
BharatBI Google Sheets Connector — connects to user's Google Sheets
and treats each sheet tab as a database table.

Flow:
1. User authenticates via Google OAuth
2. User picks a spreadsheet
3. BharatBI reads all sheet tabs → each becomes a staging table in PostgreSQL
4. Headers (row 1) become column names, rows 2+ become data
5. Schema goes through the normal embedding pipeline
6. User can query their spreadsheet data with natural language

Why this matters for India:
Millions of Indian SMBs run their business on Google Sheets.
Inventory tracking, sales logs, employee data — all in sheets.
BharatBI makes all of that queryable without SQL.
"""
import os
import re
import asyncpg
from typing import Any
from dataclasses import dataclass, field

from packages.connectors.base import BaseConnector, SchemaInfo, TableInfo, ColumnInfo


@dataclass
class SheetTab:
    """A single sheet tab parsed into rows."""
    name: str
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    row_count: int = 0


@dataclass
class SheetsData:
    """Parsed Google Sheets data — all tabs."""
    spreadsheet_id: str = ""
    spreadsheet_title: str = ""
    tabs: list[SheetTab] = field(default_factory=list)


def _sanitize_table_name(name: str) -> str:
    """Convert sheet tab name to a valid SQL table name."""
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9_]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return f"sheets_{name}" if name else "sheets_data"


def _sanitize_col_name(name: str) -> str:
    """Convert header to a valid SQL column name."""
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9_]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return name or "col"


def _infer_pg_type(values: list[str]) -> str:
    """Infer PostgreSQL data type from sample values."""
    non_empty = [v for v in values[:20] if v.strip()]
    if not non_empty:
        return "TEXT"

    # Check if all numeric
    numeric_count = 0
    has_decimal = False
    for v in non_empty:
        cleaned = v.replace(",", "").replace("₹", "").replace("Rs", "").replace("Rs.", "").strip()
        try:
            float(cleaned)
            numeric_count += 1
            if "." in cleaned:
                has_decimal = True
        except ValueError:
            pass

    if numeric_count == len(non_empty):
        return "NUMERIC(15,2)" if has_decimal else "INTEGER"

    # Check if all dates
    date_patterns = [
        r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
        r'\d{2}/\d{2}/\d{4}',  # DD/MM/YYYY
        r'\d{2}-\d{2}-\d{4}',  # DD-MM-YYYY
    ]
    date_count = 0
    for v in non_empty:
        for pattern in date_patterns:
            if re.match(pattern, v.strip()):
                date_count += 1
                break
    if date_count == len(non_empty):
        return "DATE"

    return "TEXT"


async def fetch_spreadsheet_data(
    credentials: dict,
    spreadsheet_id: str,
) -> SheetsData:
    """
    Fetch all sheet tabs from a Google Spreadsheet using the Sheets API.
    credentials: OAuth2 token dict with access_token
    """
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=credentials.get("access_token"),
        refresh_token=credentials.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
    )

    service = build("sheets", "v4", credentials=creds)

    # Get spreadsheet metadata
    spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    title = spreadsheet.get("properties", {}).get("title", "")

    data = SheetsData(spreadsheet_id=spreadsheet_id, spreadsheet_title=title)

    # Get all sheet names
    sheets = spreadsheet.get("sheets", [])
    ranges = [s["properties"]["title"] for s in sheets]

    if not ranges:
        return data

    # Batch read all sheets
    result = service.spreadsheets().values().batchGet(
        spreadsheetId=spreadsheet_id,
        ranges=ranges,
    ).execute()

    for vr in result.get("valueRanges", []):
        sheet_name = vr.get("range", "").split("!")[0].strip("'")
        values = vr.get("values", [])

        if not values or len(values) < 2:
            continue  # Need at least headers + 1 data row

        headers = [str(h).strip() for h in values[0]]
        rows = []
        for row in values[1:]:
            # Pad short rows with empty strings
            padded = [str(cell).strip() if i < len(row) else "" for i, cell in enumerate(row)]
            while len(padded) < len(headers):
                padded.append("")
            rows.append(padded)

        data.tabs.append(SheetTab(
            name=sheet_name,
            headers=headers,
            rows=rows,
            row_count=len(rows),
        ))

    return data


def parse_sheets_from_csv(csv_content: str, sheet_name: str = "sheet1") -> SheetsData:
    """
    Parse a CSV string as if it were a Google Sheet tab.
    Useful for testing and for users who export sheets as CSV.
    """
    import csv
    import io

    reader = csv.reader(io.StringIO(csv_content))
    all_rows = list(reader)

    if len(all_rows) < 2:
        return SheetsData(tabs=[])

    headers = [h.strip() for h in all_rows[0]]
    rows = []
    for row in all_rows[1:]:
        padded = [str(c).strip() if i < len(row) else "" for i, c in enumerate(row)]
        while len(padded) < len(headers):
            padded.append("")
        rows.append(padded)

    return SheetsData(
        spreadsheet_title=sheet_name,
        tabs=[SheetTab(name=sheet_name, headers=headers, rows=rows, row_count=len(rows))],
    )


async def create_sheets_staging(
    pool: asyncpg.Pool,
    data: SheetsData,
    schema: str = "public",
) -> dict[str, int]:
    """
    Create PostgreSQL staging tables from Google Sheets data.
    Each sheet tab becomes a table. Row 1 = column names, rows 2+ = data.
    """
    counts = {}

    async with pool.acquire() as conn:
        for tab in data.tabs:
            if not tab.headers or not tab.rows:
                continue

            table_name = _sanitize_table_name(tab.name)
            col_names = [_sanitize_col_name(h) for h in tab.headers]

            # De-duplicate column names
            seen = {}
            unique_cols = []
            for c in col_names:
                if c in seen:
                    seen[c] += 1
                    unique_cols.append(f"{c}_{seen[c]}")
                else:
                    seen[c] = 0
                    unique_cols.append(c)
            col_names = unique_cols

            # Infer types from data
            col_types = []
            for i, col in enumerate(col_names):
                values = [row[i] for row in tab.rows if i < len(row)]
                col_types.append(_infer_pg_type(values))

            # Drop and create table
            await conn.execute(f'DROP TABLE IF EXISTS {schema}."{table_name}"')

            col_defs = ", ".join(
                f'"{col}" {dtype}' for col, dtype in zip(col_names, col_types)
            )
            await conn.execute(
                f'CREATE TABLE {schema}."{table_name}" (id SERIAL PRIMARY KEY, {col_defs})'
            )

            # Insert rows
            if tab.rows:
                placeholders = ", ".join(f"${i+1}" for i in range(len(col_names)))
                col_list = ", ".join(f'"{c}"' for c in col_names)

                insert_rows = []
                for row in tab.rows:
                    processed = []
                    for i, (val, dtype) in enumerate(zip(row, col_types)):
                        if i >= len(row):
                            processed.append(None)
                        elif not val or val.strip() == "":
                            processed.append(None)
                        elif "NUMERIC" in dtype or dtype == "INTEGER":
                            cleaned = val.replace(",", "").replace("₹", "").replace("Rs", "").replace("Rs.", "").strip()
                            try:
                                processed.append(str(float(cleaned)))
                            except ValueError:
                                processed.append(None)
                        else:
                            processed.append(val)
                    # Pad if needed
                    while len(processed) < len(col_names):
                        processed.append(None)
                    insert_rows.append(tuple(processed))

                await conn.executemany(
                    f'INSERT INTO {schema}."{table_name}" ({col_list}) VALUES ({placeholders})',
                    insert_rows,
                )
                counts[table_name] = len(insert_rows)

    return counts


def build_schema_from_sheets(data: SheetsData, counts: dict) -> SchemaInfo:
    """Build SchemaInfo from Google Sheets staging tables for the embedding pipeline."""
    tables = []

    for tab in data.tabs:
        table_name = _sanitize_table_name(tab.name)
        row_count = counts.get(table_name, tab.row_count)
        col_names = [_sanitize_col_name(h) for h in tab.headers]

        # Infer types
        columns = []
        for i, (col, header) in enumerate(zip(col_names, tab.headers)):
            values = [row[i] for row in tab.rows if i < len(row)]
            pg_type = _infer_pg_type(values)
            samples = [v for v in values[:3] if v.strip()]

            columns.append(ColumnInfo(
                name=col,
                data_type=pg_type.lower().replace("(15,2)", ""),
                description=f"From sheet column '{header}'",
                sample_values=samples,
            ))

        if columns:
            tables.append(TableInfo(
                name=table_name,
                description=f"Google Sheets tab '{tab.name}' from '{data.spreadsheet_title}'",
                row_count=row_count,
                columns=columns,
            ))

    return SchemaInfo(tables=tables, dialect="postgresql", database_name="bharatbi")