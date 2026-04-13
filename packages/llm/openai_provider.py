from __future__ import annotations
"""
CueBI — OpenAI LLM Provider
Implements BaseLLMProvider using GPT-4o.

Temperature is always 0.0 for SQL generation — we want deterministic output.
"""

import os
import json
from typing import Optional
from openai import AsyncOpenAI
from .base import BaseLLMProvider, SQLGenerationResult, SummaryResult


class OpenAIProvider(BaseLLMProvider):

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._model = model
        self._client = AsyncOpenAI(api_key=self._api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model

    async def generate_sql(self, prompt: str, temperature: float = 0.0) -> SQLGenerationResult:
        from packages.core.prompt_builder import SYSTEM_PROMPT

        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(raw)
            return SQLGenerationResult(
                sql=parsed.get("sql", "").strip(),
                explanation=parsed.get("explanation", ""),
                raw_response=raw,
            )
        except json.JSONDecodeError:
            # Fallback: try to extract SQL even if JSON is malformed
            return SQLGenerationResult(sql="", explanation="Parse error", raw_response=raw)

    async def summarize(
        self,
        question: str,
        columns: list[str],
        rows: list[list],
        max_rows: int = 5,
    ) -> SummaryResult:
        from packages.core.prompt_builder import build_summary_prompt
        prompt = build_summary_prompt(question, columns, rows, max_rows)

        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=0.3,   # slight creativity for summaries
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(raw)
            return SummaryResult(
                summary=parsed.get("summary", ""),
                suggested_questions=parsed.get("suggested_questions", []),
            )
        except json.JSONDecodeError:
            return SummaryResult(summary=raw[:300], suggested_questions=[])

    async def generate_descriptions(
        self,
        schema_items: list[dict],
        dialect: str = "postgresql",
    ) -> list[str]:
        """
        Batch-generates human-readable descriptions for schema columns.
        Sends all items in one prompt to save API calls.
        """
        items_text = "\n".join(
            f"{i+1}. Table: {item['table']}, Column: {item.get('column', '[table]')}, "
            f"Type: {item.get('type', 'unknown')}, "
            f"Samples: {item.get('samples', [])}"
            for i, item in enumerate(schema_items)
        )

        prompt = f"""You are documenting a {dialect} database for business users.
For each column below, write a SHORT (max 10 words) plain English description of what it contains.
Focus on business meaning, not technical type.

{items_text}

Respond ONLY with a JSON array of strings, one per item, same order:
["description 1", "description 2", ...]"""

        response = await self._client.chat.completions.create(
            model="gpt-4o-mini",  # cheaper for batch description generation
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Return only a JSON array of strings."},
                {"role": "user",   "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "[]"
        try:
            # The model might return {"descriptions": [...]} or just [...]
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            for key in parsed:
                if isinstance(parsed[key], list):
                    return parsed[key]
            return [""] * len(schema_items)
        except json.JSONDecodeError:
            return [""] * len(schema_items)
