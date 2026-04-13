from __future__ import annotations

"""SQL Explain API — explains generated SQL in plain English for non-technical users."""
from fastapi import APIRouter
from pydantic import BaseModel

from packages.llm import get_llm_provider

router = APIRouter()


class ExplainRequest(BaseModel):
    sql: str
    llm_provider: str = "openai"


@router.post("/explain-sql")
async def explain_sql(req: ExplainRequest):
    """
    Takes a SQL query and returns a plain English, step-by-step explanation
    for non-technical users.
    """
    llm = get_llm_provider(req.llm_provider)

    prompt = (
        "You are explaining a SQL query to a business user who has ZERO SQL knowledge.\n\n"
        "SQL Query:\n"
        f"```sql\n{req.sql}\n```\n\n"
        "Explain this query in simple English:\n"
        "1. What data is being looked at? (which tables)\n"
        "2. What filters or conditions are applied?\n"
        "3. How is the data grouped or sorted?\n"
        "4. What is the final result? (what will the user see)\n\n"
        "Keep it under 100 words. Use bullet points. No technical jargon."
    )

    try:
        result = await llm.summarize(question=prompt, columns=[], rows=[])
        explanation = result.summary.strip() if result.summary else "Unable to generate explanation."
    except Exception as e:
        explanation = f"Could not generate explanation: {str(e)}"

    return {"sql": req.sql, "explanation": explanation}
