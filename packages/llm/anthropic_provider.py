from __future__ import annotations
"""
CueBI — Anthropic LLM Provider
Implements BaseLLMProvider using Claude Sonnet.
"""

import os
import json
from typing import Optional
import anthropic
from .base import BaseLLMProvider, SQLGenerationResult, SummaryResult


class AnthropicProvider(BaseLLMProvider):

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-sonnet-4-5"):
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self._model = model
        self._client = anthropic.AsyncAnthropic(api_key=self._api_key)

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_name(self) -> str:
        return self._model

    async def generate_sql(self, prompt: str, temperature: float = 0.0) -> SQLGenerationResult:
        from packages.core.prompt_builder import SYSTEM_PROMPT

        message = await self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            temperature=temperature,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else "{}"

        # Claude sometimes wraps JSON in ```json ... ``` — strip it
        raw_clean = raw.strip()
        if raw_clean.startswith("```"):
            raw_clean = raw_clean.split("```")[1]
            if raw_clean.startswith("json"):
                raw_clean = raw_clean[4:]
            raw_clean = raw_clean.strip()

        try:
            parsed = json.loads(raw_clean)
            return SQLGenerationResult(
                sql=parsed.get("sql", "").strip(),
                explanation=parsed.get("explanation", ""),
                raw_response=raw,
            )
        except json.JSONDecodeError:
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

        message = await self._client.messages.create(
            model=self._model,
            max_tokens=512,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        raw_clean = raw.strip().lstrip("```json").rstrip("```").strip()
        try:
            parsed = json.loads(raw_clean)
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
        items_text = "\n".join(
            f"{i+1}. Table: {item['table']}, Column: {item.get('column', '[table]')}, "
            f"Type: {item.get('type', 'unknown')}, Samples: {item.get('samples', [])}"
            for i, item in enumerate(schema_items)
        )

        prompt = f"""You are documenting a {dialect} database for business users.
For each item below, write a SHORT (max 10 words) plain English description.

{items_text}

Return ONLY a JSON array of strings, one per item:
["description 1", "description 2", ...]"""

        message = await self._client.messages.create(
            model="claude-haiku-4-5-20251001",  # faster + cheaper for descriptions
            max_tokens=2048,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else "[]"
        raw_clean = raw.strip().lstrip("```json").rstrip("```").strip()
        try:
            parsed = json.loads(raw_clean)
            if isinstance(parsed, list):
                return parsed
            for key in parsed:
                if isinstance(parsed[key], list):
                    return parsed[key]
            return [""] * len(schema_items)
        except json.JSONDecodeError:
            return [""] * len(schema_items)