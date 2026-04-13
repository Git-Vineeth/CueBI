from __future__ import annotations
"""
CueBI — Connector Registry
Single entry point: get_connector(type, credentials) → BaseConnector

Adding a new connector = add one import + one dict entry here.
"""

from .base import BaseConnector
from .postgresql import PostgreSQLConnector
from .mysql import MySQLConnector
from .redshift import RedshiftConnector


def get_connector(connector_type: str, credentials: dict) -> BaseConnector:
    """
    Factory function — returns the right connector for a given type.

    Args:
        connector_type: 'postgresql' | 'mysql' | 'redshift' | 'rds_postgresql' | 'rds_mysql'
        credentials: dict with connection params (host, port, user, password, etc.)

    Returns:
        An initialized BaseConnector subclass (not yet connected).

    Raises:
        ValueError: if connector_type is unknown.
    """
    registry = {
        "postgresql":    _make_postgresql,
        "mysql":         _make_mysql,
        "redshift":      _make_redshift,
        "rds_postgresql": _make_postgresql,  # RDS PostgreSQL uses the same connector
        "rds_mysql":     _make_mysql,        # RDS MySQL uses the same connector
    }

    factory = registry.get(connector_type)
    if not factory:
        available = list(registry.keys())
        raise ValueError(
            f"Unknown connector type '{connector_type}'. "
            f"Available: {available}"
        )
    return factory(credentials)


def _make_postgresql(creds: dict) -> PostgreSQLConnector:
    return PostgreSQLConnector(
        host=creds["host"],
        port=int(creds.get("port", 5432)),
        database=creds["database"],
        username=creds["username"],
        password=creds["password"],
        ssl=creds.get("ssl", False),
    )


def _make_mysql(creds: dict) -> MySQLConnector:
    return MySQLConnector(
        host=creds["host"],
        port=int(creds.get("port", 3306)),
        database=creds["database"],
        username=creds["username"],
        password=creds["password"],
    )


def _make_redshift(creds: dict) -> RedshiftConnector:
    return RedshiftConnector(
        host=creds["host"],
        port=int(creds.get("port", 5439)),
        database=creds["database"],
        username=creds["username"],
        password=creds["password"],
        ssl=creds.get("ssl", True),
    )


__all__ = ["get_connector", "BaseConnector", "PostgreSQLConnector", "MySQLConnector", "RedshiftConnector"]