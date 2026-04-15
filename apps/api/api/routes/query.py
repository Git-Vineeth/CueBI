from __future__ import annotations

"""Query API — the main CueBI pipeline: question → SQL → results → chart → summary."""

import json
import time
import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from apps.api.api.deps import get_current_user
from packages.connectors import get_connector
from packages.core.embedder import search_schema
from packages.core.prompt_builder import build_sql_prompt
from packages.core.sql_validator import parse_sql, validate_and_fix_sql
from packages.charts.recommender import recommend_chart
from packages.llm import get_llm_provider

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    connection_id: str
    llm_provider: str = "openai"  # openai or anthropic


@router.post("/query")
async def run_query(req: QueryRequest, request: Request):
    """Full 10-step query pipeline with per-team schema access filtering."""
    start_time = time.time()

    # Auth: get caller identity
    user = await get_current_user(request)
    org_id = user["org_id"]
    user_id = user["user_id"]
    team_id = user.get("team_id")

    # Step 1: Get connection details (scoped to org)
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT * FROM connections
                WHERE id = :id AND org_id = :org_id AND status = 'ready'
            """),
            {"id": req.connection_id, "org_id": org_id},
        )
        conn_row = result.mappings().first()
        if not conn_row:
            raise HTTPException(
                status_code=400,
                detail="Connection not found or not synced. Run /api/connections/{id}/sync first.",
            )

    # Step 1b: Get team's allowed tables (for schema filtering in Qdrant)
    allowed_tables: list[str] | None = None
    if team_id:
        async with async_session() as db:
            result = await db.execute(
                text("SELECT table_name FROM team_schema_access WHERE team_id = :team_id"),
                {"team_id": team_id},
            )
            rows = result.mappings().all()
            if rows:
                allowed_tables = [r["table_name"] for r in rows]

    # Step 2: Embed the user's question and search Qdrant
    schema_chunks = await search_schema(
        question=req.question,
        connection_id=req.connection_id,
        top_k=8,
        allowed_tables=allowed_tables,
    )

    if not schema_chunks:
        raise HTTPException(status_code=400, detail="No schema context found. Please sync the connection first.")

    # Step 3: Build the prompt
    dialect = conn_row["conn_type"]
    prompt = build_sql_prompt(
        question=req.question,
        schema_chunks=schema_chunks,
        dialect=dialect,
    )

    # Step 4: Call LLM to generate SQL
    llm = get_llm_provider(req.llm_provider)
    llm_result = await llm.generate_sql(prompt)
    generated_sql = llm_result.sql
    explanation = llm_result.explanation

    if not generated_sql:
        raise HTTPException(status_code=400, detail="LLM did not generate SQL.")

    # Step 5: Validate SQL (with auto-retry)
    credentials = {
        "host": conn_row["host"],
        "port": conn_row["port"],
        "username": conn_row["username"],
        "password": conn_row["password_enc"],
        "database": conn_row["database_name"],
    }
    connector = get_connector(dialect, credentials)

    final_sql, validation_error = await validate_and_fix_sql(
        sql=generated_sql,
        dialect=dialect,
        connector=connector,
        llm_provider=llm,
        original_question=req.question,
        schema_chunks=schema_chunks,
        max_retries=3,
    )

    if validation_error:
        await connector.close()
        raise HTTPException(
            status_code=400,
            detail=f"SQL validation failed: {validation_error}",
        )

    # Step 6: Execute SQL on user's database
    try:
        columns, rows = await connector.execute_query(final_sql)
    except Exception as e:
        await connector.close()
        raise HTTPException(status_code=400, detail=f"SQL execution error: {str(e)}")
    finally:
        await connector.close()

    row_count = len(rows)

    # Step 7: Recommend chart
    chart_config = recommend_chart(columns, rows)

    # Step 8: Generate AI summary
    summary_text = ""
    suggested_questions = []
    try:
        summary_result = await llm.summarize(
            question=req.question,
            columns=columns,
            rows=rows,
        )
        summary_text = summary_result.summary
        suggested_questions = summary_result.suggested_questions
    except Exception:
        summary_text = f"Query returned {row_count} rows."

    # Step 9: Save to query history (scoped to user + team)
    duration_ms = int((time.time() - start_time) * 1000)
    query_id = None
    try:
        async with async_session() as db:
            result = await db.execute(
                text("""
                    INSERT INTO queries
                        (org_id, user_id, team_id, connection_id, question, generated_sql,
                         result_row_count, duration_ms, llm_provider, status, chart_type, summary)
                    VALUES
                        (:org_id, :user_id, :team_id, :cid, :question, :sql,
                         :rows, :ms, :llm, 'success', :chart, :summary)
                    RETURNING id
                """),
                {
                    "org_id": org_id,
                    "user_id": user_id,
                    "team_id": team_id,
                    "cid": req.connection_id,
                    "question": req.question,
                    "sql": final_sql,
                    "rows": row_count,
                    "ms": duration_ms,
                    "llm": req.llm_provider,
                    "chart": chart_config.chart_type if chart_config else None,
                    "summary": summary_text,
                },
            )
            await db.commit()
            query_id = str(result.scalars().first())
    except Exception:
        pass

    # Step 10: Serialize and return
    serialized_rows = []
    for row in rows:
        serialized = []
        for v in row:
            if isinstance(v, (datetime.date, datetime.datetime)):
                serialized.append(v.isoformat())
            elif isinstance(v, (int, float, str, bool, type(None))):
                serialized.append(v)
            else:
                serialized.append(str(v))
        serialized_rows.append(serialized)

    return {
        "query_id": query_id,
        "question": req.question,
        "sql": final_sql,
        "explanation": explanation,
        "columns": columns,
        "rows": serialized_rows[:1000],
        "row_count": row_count,
        "chart": {
            "chart_type": chart_config.chart_type,
            "title": chart_config.title,
            "echarts_option": chart_config.echarts_option,
        } if chart_config else None,
        "summary": summary_text,
        "suggested_questions": suggested_questions,
        "duration_ms": duration_ms,
        "llm_provider": req.llm_provider,
    }


@router.get("/queries")
async def list_queries(request: Request, limit: int = 20):
    """Get recent query history, scoped to the calling user's team."""
    user = await get_current_user(request)
    team_id = user.get("team_id")

    async with async_session() as db:
        # Admins without a team see all queries in the org; team members see only their team
        if team_id:
            result = await db.execute(
                text("""
                    SELECT id, question, generated_sql, result_row_count, duration_ms,
                           llm_provider, status, chart_type, summary, created_at
                    FROM queries
                    WHERE team_id = :team_id
                    ORDER BY created_at DESC LIMIT :limit
                """),
                {"team_id": team_id, "limit": limit},
            )
        else:
            result = await db.execute(
                text("""
                    SELECT id, question, generated_sql, result_row_count, duration_ms,
                           llm_provider, status, chart_type, summary, created_at
                    FROM queries
                    WHERE org_id = :org_id
                    ORDER BY created_at DESC LIMIT :limit
                """),
                {"org_id": user["org_id"], "limit": limit},
            )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
