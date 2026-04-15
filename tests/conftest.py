"""Shared fixtures for all CueBI tests."""
import pytest
from packages.connectors.base import SchemaInfo, TableInfo, ColumnInfo


@pytest.fixture
def sample_indian_schema() -> SchemaInfo:
    """A realistic Indian e-commerce schema for testing."""
    return SchemaInfo(
        dialect="postgresql",
        database_name="cuebi_test",
        tables=[
            TableInfo(
                name="customers",
                row_count=5000,
                description="Indian customer records",
                columns=[
                    ColumnInfo(name="customer_id", data_type="integer", is_primary_key=True, is_nullable=False,
                               sample_values=["1001", "1002", "1003"]),
                    ColumnInfo(name="name", data_type="varchar",
                               sample_values=["Rajesh Kumar", "Priya Sharma", "Amit Patel"]),
                    ColumnInfo(name="city", data_type="varchar",
                               sample_values=["Mumbai", "Delhi", "Bengaluru"]),
                    ColumnInfo(name="state", data_type="varchar",
                               sample_values=["Maharashtra", "Delhi", "Karnataka"]),
                    ColumnInfo(name="gstin", data_type="varchar",
                               sample_values=["27AABCU9603R1ZM", "07AAACH7409R1ZS"]),
                    ColumnInfo(name="created_at", data_type="timestamp"),
                ],
            ),
            TableInfo(
                name="orders",
                row_count=25000,
                description="Sales orders with GST",
                columns=[
                    ColumnInfo(name="order_id", data_type="integer", is_primary_key=True, is_nullable=False),
                    ColumnInfo(name="customer_id", data_type="integer",
                               is_foreign_key=True, references_table="customers", references_column="customer_id"),
                    ColumnInfo(name="order_date", data_type="date",
                               sample_values=["2025-04-15", "2025-06-20", "2025-11-01"]),
                    ColumnInfo(name="amount", data_type="numeric",
                               sample_values=["15000.00", "250000.50", "8500.00"]),
                    ColumnInfo(name="gst_amount", data_type="numeric",
                               sample_values=["2700.00", "45000.09", "1530.00"]),
                    ColumnInfo(name="status", data_type="varchar",
                               sample_values=["delivered", "pending", "cancelled"]),
                ],
            ),
            TableInfo(
                name="products",
                row_count=800,
                description="Product catalogue",
                columns=[
                    ColumnInfo(name="product_id", data_type="integer", is_primary_key=True, is_nullable=False),
                    ColumnInfo(name="name", data_type="varchar", sample_values=["Laptop", "Printer", "Mouse"]),
                    ColumnInfo(name="category", data_type="varchar",
                               sample_values=["Electronics", "Stationery", "Furniture"]),
                    ColumnInfo(name="price", data_type="numeric",
                               sample_values=["45000", "12000", "500"]),
                    ColumnInfo(name="hsn_code", data_type="varchar",
                               sample_values=["8471", "8443", "8471"]),
                ],
            ),
        ],
    )


@pytest.fixture
def sample_query_result_timeseries() -> dict:
    """Monthly revenue result — should trigger line chart."""
    return {
        "columns": ["month", "revenue"],
        "rows": [
            ["2025-04", 1500000],
            ["2025-05", 1800000],
            ["2025-06", 2100000],
            ["2025-07", 1950000],
            ["2025-08", 2400000],
            ["2025-09", 2200000],
            ["2025-10", 2800000],
        ],
    }


@pytest.fixture
def sample_query_result_categories() -> dict:
    """Top 5 cities by revenue — should trigger bar chart."""
    return {
        "columns": ["city", "total_revenue"],
        "rows": [
            ["Mumbai", 5000000],
            ["Delhi", 4200000],
            ["Bengaluru", 3800000],
            ["Hyderabad", 2100000],
            ["Chennai", 1900000],
            ["Pune", 1700000],
            ["Ahmedabad", 1500000],
            ["Kolkata", 1300000],
        ],
    }


@pytest.fixture
def sample_query_result_pie() -> dict:
    """Order status distribution — should trigger pie chart."""
    return {
        "columns": ["status", "count"],
        "rows": [
            ["delivered", 15000],
            ["pending", 5000],
            ["cancelled", 2000],
            ["returned", 800],
        ],
    }


@pytest.fixture
def sample_query_result_scalar() -> dict:
    """Single value — no chart."""
    return {
        "columns": ["total_revenue"],
        "rows": [[12500000]],
    }
