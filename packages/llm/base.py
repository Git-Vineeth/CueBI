from __future__ import annotations
"""
CueBI — LLM Provider Base Class
All LLM providers (OpenAI, Anthropic) implement this interface.
This means you can swap providers with zero changes to the query pipeline.
"""

from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass


@dataclass
class SQLGenerationResult:
    sql: str
    explanation: str
    raw_response: str


@dataclass
class SummaryResult:
    summary: str
    suggested_questions: list[str]


class BaseLLMProvider(ABC):
    """
    Abstract base class for all CueBI LLM providers.

    To add a new LLM provider:
    1. Create a new file: packages/llm/your_provider.py
    2. Implement this class
    3. Register it in packages/llm/router.py
    That's it — the query pipeline will use it automatically.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier for this provider, e.g. 'openai' or 'anthropic'."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The specific model being used, e.g. 'gpt-4o'."""

    @abstractmethod
    async def generate_sql(
        self,
        prompt: str,
        temperature: float = 0.0,
    ) -> SQLGenerationResult:
        """
        Given a fully assembled prompt (system + schema + question),
        generate a SQL query.

        Temperature should be 0.0 for deterministic SQL generation.
        Returns SQLGenerationResult with sql + explanation.
        """

    @abstractmethod
    async def summarize(
        self,
        question: str,
        columns: list[str],
        rows: list[list],
        max_rows: int = 5,
    ) -> SummaryResult:
        """
        Given the query result, write a 2-3 sentence plain English insight
        and suggest 3 follow-up questions.
        """

    @abstractmethod
    async def generate_descriptions(
        self,
        schema_items: list[dict],
        dialect: str = "postgresql",
    ) -> list[str]:
        """
        Given a list of schema items (table/column info),
        generate human-readable descriptions for each.
        Used during schema ingestion (runs once, cached).

        schema_items format:
        [{"table": "orders", "column": "amount", "type": "NUMERIC"}, ...]
        """