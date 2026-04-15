from __future__ import annotations
"""
CueBI — Prompt Builder
Assembles the final prompt sent to the LLM for SQL generation.

This is the most important file for SQL accuracy.
Better prompts = better SQL = happier users.
"""

from datetime import date
from typing import Optional


# ── System prompt ─────────────────────────────────────────────

SYSTEM_PROMPT = """You are CueBI, an expert SQL analyst.
Your job: convert a natural language question into a valid SQL query.

STRICT RULES:
1. Return ONLY valid JSON in this exact format:
   {{"sql": "SELECT ...", "explanation": "One sentence in plain English"}}
2. Use ONLY the tables and columns listed in SCHEMA below. No invented columns.
3. Use the database dialect specified (postgresql, mysql, or redshift). No dialect mixing.
4. Always add LIMIT 1000 unless the user asks for a different number.
5. For aggregations, always alias the result columns clearly (e.g. AS total_revenue).
6. If a question is ambiguous, pick the most reasonable interpretation.
7. Never generate INSERT, UPDATE, DELETE, DROP, or DDL statements.
8. Do not use markdown code fences in your response. Pure JSON only.
9. Use SCHEMA-QUALIFIED table names exactly as shown (e.g. analytics.dim_students).
10. Use JOIN RELATIONSHIPS listed below — do not invent join conditions.
"""

# ── Few-shot examples ─────────────────────────────────────────

FEW_SHOT_EXAMPLES = [
    {
        "question": "What is the total revenue this month?",
        "sql": "SELECT SUM(amount) AS total_revenue FROM orders WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'",
        "explanation": "Sum of all order amounts for the current calendar month.",
    },
    {
        "question": "Top 5 customers by revenue",
        "sql": "SELECT customer_name, SUM(amount) AS total_revenue FROM orders JOIN customers ON orders.customer_id = customers.id GROUP BY customer_name ORDER BY total_revenue DESC LIMIT 5",
        "explanation": "Five customers with the highest total order value.",
    },
    {
        "question": "Month on month revenue trend",
        "sql": "SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS monthly_revenue FROM orders GROUP BY month ORDER BY month",
        "explanation": "Total revenue grouped by month, sorted chronologically.",
    },
    {
        "question": "Which products are running low in stock?",
        "sql": "SELECT product_name, stock_quantity FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC LIMIT 1000",
        "explanation": "Products with fewer than 10 units in stock, sorted from lowest to highest.",
    },
]


# ── Prompt assembly ───────────────────────────────────────────

def _extract_join_hints(schema_chunks: list[dict]) -> str:
    """
    Builds a JOIN RELATIONSHIPS section from FK metadata in schema chunks.
    Each FK in the retrieved chunks becomes an explicit join hint for the LLM.
    """
    hints = []
    seen = set()
    for chunk in schema_chunks:
        if chunk.get("chunk_type") != "column":
            continue
        if not chunk.get("is_foreign_key"):
            continue

        table = chunk.get("sql_name") or chunk.get("table", "")
        col = chunk.get("column", "")
        ref_table = chunk.get("references_table", "")
        ref_col = chunk.get("references_column", "")

        if not all([table, col, ref_table, ref_col]):
            continue

        hint = f"{table}.{col} → {ref_table}.{ref_col}"
        if hint not in seen:
            seen.add(hint)
            hints.append(f"  • {hint}")

    if not hints:
        return ""
    return "JOIN RELATIONSHIPS (use these exact conditions for JOINs):\n" + "\n".join(hints)


def build_sql_prompt(
    question: str,
    schema_chunks: list[dict],
    dialect: str = "postgresql",
    few_shot_count: int = 2,
    extra_context: Optional[str] = None,
) -> str:
    """
    Assembles the full prompt for SQL generation.

    Args:
        question: The user's natural language question
        schema_chunks: Retrieved schema chunks from Qdrant (top-k)
        dialect: 'postgresql', 'mysql', or 'redshift'
        few_shot_count: How many few-shot examples to include
        extra_context: Any additional context (e.g. previous error message)

    Returns:
        The full prompt string to send to the LLM.
    """
    today = date.today()

    prompt_parts = []

    # 1. Date context
    prompt_parts.append(
        f"CURRENT DATE: {today.isoformat()}\n"
        f"DATABASE DIALECT: {dialect.upper()}\n"
    )

    # 2. Schema context
    prompt_parts.append("SCHEMA (relevant tables and columns from the user's database):")
    for chunk in schema_chunks:
        prompt_parts.append(f"\n---\n{chunk.get('text', '')}")
    prompt_parts.append("---")

    # 2b. Join hints (derived from FK metadata in retrieved chunks)
    join_hints = _extract_join_hints(schema_chunks)
    if join_hints:
        prompt_parts.append(f"\n{join_hints}")

    # 3. Few-shot examples
    prompt_parts.append("\nEXAMPLES OF GOOD SQL GENERATION:")
    for ex in FEW_SHOT_EXAMPLES[:few_shot_count]:
        prompt_parts.append(
            f'\nQ: "{ex["question"]}"\n'
            f'A: {{"sql": "{ex["sql"]}", "explanation": "{ex["explanation"]}"}}'
        )

    # 4. Error context (for retry)
    if extra_context:
        prompt_parts.append(f"\nPREVIOUS ATTEMPT FAILED WITH ERROR:\n{extra_context}")
        prompt_parts.append("Fix the SQL so it does not produce this error.")

    # 5. The actual question
    prompt_parts.append(f'\nQUESTION: "{question}"')
    prompt_parts.append('\nRespond with JSON only:')

    return "\n".join(prompt_parts)


def build_summary_prompt(
    question: str,
    columns: list[str],
    rows: list[list],
    max_rows: int = 5,
) -> str:
    """
    Assembles the prompt for generating a plain English result summary.
    """
    header = " | ".join(columns)
    separator = " | ".join(["---"] * len(columns))
    data_rows = []
    for row in rows[:max_rows]:
        data_rows.append(" | ".join(str(v) for v in row))
    table_str = "\n".join([header, separator] + data_rows)

    return f"""The user asked: "{question}"

The query returned this data:
{table_str}
{"[... and more rows]" if len(rows) > max_rows else ""}

Write a 2-3 sentence plain English summary of what this data shows.
Focus on the key insight. Be direct and specific — mention actual numbers from the data.
Do not start with "The data shows" or "Based on the query".
Then suggest 3 short follow-up questions the user might ask next.

Respond in this JSON format:
{{"summary": "...", "suggested_questions": ["...", "...", "..."]}}"""
