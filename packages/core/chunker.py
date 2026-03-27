"""
BharatBI — Schema Chunker
Converts a SchemaInfo object into text chunks ready for embedding.
Each chunk = one table or one column with its context.

The quality of these chunks directly determines retrieval quality.
Better chunks → better SQL generation.
"""

from packages.connectors.base import SchemaInfo, TableInfo, ColumnInfo


def schema_to_chunks(schema: SchemaInfo) -> list[dict]:
    """
    Converts a full SchemaInfo into a flat list of text chunks.
    Each chunk has:
      - text: the string to embed
      - metadata: dict with table, column, type info (stored in Qdrant alongside the vector)

    Strategy:
    - One chunk per TABLE (describes the table and all its columns at a glance)
    - One chunk per COLUMN (detailed, with sample values — for precise column retrieval)

    This dual-chunking gives the retriever two chances to find the right context.
    """
    chunks = []

    for table in schema.tables:
        # ── Table-level chunk ──────────────────────────────────
        table_chunk = _make_table_chunk(table, schema)
        chunks.append(table_chunk)

        # ── Column-level chunks ────────────────────────────────
        for col in table.columns:
            col_chunk = _make_column_chunk(table, col, schema)
            chunks.append(col_chunk)

    return chunks


def _make_table_chunk(table: TableInfo, schema: SchemaInfo) -> dict:
    """
    Creates a high-level chunk for a table.
    Example text:
      Table: orders (PostgreSQL)
      Approx rows: 15,420
      Columns: order_id (uuid, PK), customer_id (uuid, FK→customers.id),
               amount (numeric), status (text), created_at (timestamp)
      Description: [LLM-generated, filled later]
    """
    col_summaries = []
    for col in table.columns:
        flags = []
        if col.is_primary_key:
            flags.append("PK")
        if col.is_foreign_key:
            flags.append(f"FK→{col.references_table}.{col.references_column}")
        flag_str = f" [{', '.join(flags)}]" if flags else ""
        col_summaries.append(f"{col.name} ({col.data_type}{flag_str})")

    row_count_str = f"{table.row_count:,}" if table.row_count else "unknown"

    text = (
        f"Table: {table.name} ({schema.dialect} database: {schema.database_name})\n"
        f"Approximate rows: {row_count_str}\n"
        f"Columns: {', '.join(col_summaries)}\n"
    )
    if table.description:
        text += f"Description: {table.description}\n"

    return {
        "text": text.strip(),
        "metadata": {
            "chunk_type": "table",
            "table": table.name,
            "column": None,
            "dialect": schema.dialect,
            "database": schema.database_name,
        }
    }


def _make_column_chunk(table: TableInfo, col: ColumnInfo, schema: SchemaInfo) -> dict:
    """
    Creates a detailed chunk for a single column.
    Example text:
      Column: orders.amount
      Type: numeric | Nullable: no | Primary key: no
      Foreign key: no
      Sample values: 1250.00, 3400.50, 799.00
      Description: [LLM-generated, filled later]
    """
    fk_info = ""
    if col.is_foreign_key:
        fk_info = f"Foreign key: yes → {col.references_table}.{col.references_column}\n"
    else:
        fk_info = "Foreign key: no\n"

    samples_str = ""
    if col.sample_values and col.sample_values != ["[REDACTED]"]:
        samples_str = f"Sample values: {', '.join(str(v) for v in col.sample_values[:3])}\n"

    desc_str = ""
    if col.description:
        desc_str = f"Description: {col.description}\n"

    text = (
        f"Column: {table.name}.{col.name}\n"
        f"Type: {col.data_type} | "
        f"Nullable: {'yes' if col.is_nullable else 'no'} | "
        f"Primary key: {'yes' if col.is_primary_key else 'no'}\n"
        f"{fk_info}"
        f"{desc_str}"
        f"{samples_str}"
    )
    text = text.strip()

    return {
        "text": text.strip(),
        "metadata": {
            "chunk_type": "column",
            "table": table.name,
            "column": col.name,
            "data_type": col.data_type,
            "is_primary_key": col.is_primary_key,
            "is_foreign_key": col.is_foreign_key,
            "references_table": col.references_table,
            "references_column": col.references_column,
            "dialect": schema.dialect,
            "database": schema.database_name,
        }
    }


def enrich_chunks_with_descriptions(chunks: list[dict], descriptions: list[str]) -> list[dict]:
    """
    After the LLM generates descriptions for each chunk,
    this merges them back into the chunk text.

    Args:
        chunks: list of chunks from schema_to_chunks()
        descriptions: LLM-generated description for each chunk (same order)

    Returns:
        chunks with description appended to the text field.
    """
    assert len(chunks) == len(descriptions), (
        f"Mismatch: {len(chunks)} chunks but {len(descriptions)} descriptions"
    )
    enriched = []
    for chunk, desc in zip(chunks, descriptions):
        if desc and desc.strip():
            chunk = {**chunk, "text": chunk["text"] + f"\nDescription: {desc.strip()}"}
        enriched.append(chunk)
    return enriched