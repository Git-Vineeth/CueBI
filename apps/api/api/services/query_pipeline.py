"""
CueBI — Query Pipeline Service
Orchestrates the full 10-step query flow.

Called by: apps/api/api/routes/query.py
"""

import time
import uuid
from typing import Optional

from packages.connectors import get_connector
from packages.core.embedder import search_schema
from packages.core.prompt_builder import build_sql_prompt
from packages.core.sql_validator import validate_and_fix_sql
from packages.charts.recommender import recommend_chart, ChartConfig
from packages.llm import get_llm_provider


async def run_query_pipeline(
    question: str,
    connection_id: str,
    connection_type: str,
    credentials: dict,
    llm_provider_name: str = "openai",
    user_api_key: Optional[str] = None,
    dialect: str = "postgresql",
) -> dict:
    """
    The complete CueBI query pipeline.

    Steps:
    1.  Embed user question
    2.  Search Qdrant for top-8 schema chunks
    3.  Build LLM prompt
    4.  Call LLM → get SQL
    5.  Validate SQL (parse + EXPLAIN)
    6.  Auto-retry if invalid (max 3x)
    7.  Execute SQL on user's DB
    8.  Recommend chart type
    9.  Generate AI summary + follow-up questions
    10. Return structured response

    Returns dict with: sql, columns, rows, chart, summary, suggested_questions,
                       duration_ms, llm_model, query_id
    """
    start = time.time()
    query_id = str(uuid.uuid4())

    # ── Step 1 & 2: Embed + Retrieve ─────────────────────────
    schema_chunks = await search_schema(
        question=question,
        connection_id=connection_id,
        top_k=8,
    )

    if not schema_chunks:
        return _error_response(
            query_id, question,
            "No schema found for this connection. "
            "Please wait for the schema sync to complete or re-sync.",
            time.time() - start,
        )

    # ── Step 3 & 4: Build prompt + call LLM ──────────────────
    llm = get_llm_provider(llm_provider_name, api_key=user_api_key)
    prompt = build_sql_prompt(question, schema_chunks, dialect=dialect)
    llm_result = await llm.generate_sql(prompt)

    if not llm_result.sql:
        return _error_response(
            query_id, question,
            "LLM could not generate SQL for this question. "
            "Try rephrasing or check if the relevant data exists.",
            time.time() - start,
        )

    # ── Step 5 & 6: Validate + auto-retry ────────────────────
    connector = get_connector(connection_type, credentials)
    try:
        valid_sql, error = await validate_and_fix_sql(
            sql=llm_result.sql,
            dialect=dialect,
            connector=connector,
            llm_provider=llm,
            original_question=question,
            schema_chunks=schema_chunks,
            max_retries=3,
        )

        if not valid_sql:
            return _error_response(
                query_id, question,
                f"Could not generate valid SQL after 3 attempts. "
                f"Last error: {error}",
                time.time() - start,
            )

        # ── Step 7: Execute SQL ───────────────────────────────
        columns, rows = await connector.execute_query(valid_sql, limit=1000)

    finally:
        await connector.close()

    # ── Step 8: Chart recommendation ─────────────────────────
    chart: ChartConfig = recommend_chart(columns, rows, question)

    # ── Step 9: AI summary + follow-up questions ─────────────
    summary_result = await llm.summarize(question, columns, rows, max_rows=5)

    duration_ms = int((time.time() - start) * 1000)

    return {
        "query_id": query_id,
        "question": question,
        "sql": valid_sql,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "chart": {
            "chart_type": chart.chart_type,
            "title": chart.title,
            "x_axis": chart.x_axis,
            "y_axis": chart.y_axis,
            "echarts_option": chart.echarts_option,
        },
        "summary": summary_result.summary,
        "suggested_questions": summary_result.suggested_questions,
        "duration_ms": duration_ms,
        "llm_provider": llm_provider_name,
        "llm_model": llm.model_name,
        "status": "success",
    }


def _error_response(query_id: str, question: str, message: str, elapsed: float) -> dict:
    return {
        "query_id": query_id,
        "question": question,
        "sql": "",
        "columns": [],
        "rows": [],
        "row_count": 0,
        "chart": {"chart_type": "table", "title": "Error", "echarts_option": {}},
        "summary": message,
        "suggested_questions": [],
        "duration_ms": int(elapsed * 1000),
        "llm_provider": "",
        "llm_model": "",
        "status": "error",
        "error": message,
    }