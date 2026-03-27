from __future__ import annotations
"""
BharatBI — Base Connector
Every data source connector implements this interface.

To add a new connector (e.g. Shopify, Razorpay):
1. Create packages/connectors/shopify.py
2. Implement BaseConnector
3. Register in packages/connectors/__init__.py
Done — it will appear in the UI automatically.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ColumnInfo:
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    is_foreign_key: bool = False
    references_table: Optional[str] = None
    references_column: Optional[str] = None
    description: Optional[str] = None
    sample_values: list[Any] = field(default_factory=list)


@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo] = field(default_factory=list)
    row_count: Optional[int] = None
    description: Optional[str] = None  # filled by LLM later


@dataclass
class SchemaInfo:
    tables: list[TableInfo]
    dialect: str          # postgresql | mysql | sqlite
    database_name: str


class BaseConnector(ABC):
    """Abstract base for all BharatBI data source connectors."""

    @property
    @abstractmethod
    def connector_type(self) -> str:
        """e.g. 'postgresql', 'mysql', 'google_sheets'"""

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """
        Test if the connection is valid.
        Returns (success: bool, message: str).
        """

    @abstractmethod
    async def extract_schema(self) -> SchemaInfo:
        """
        Extract full schema: all tables, columns, types, PKs, FKs.
        Also samples up to 3 values per column for context.
        """

    @abstractmethod
    async def execute_query(self, sql: str, limit: int = 1000) -> tuple[list[str], list[list[Any]]]:
        """
        Execute a SQL query and return (columns, rows).
        Always enforces a row limit for safety.
        """

    @abstractmethod
    async def close(self) -> None:
        """Release all connections/resources."""