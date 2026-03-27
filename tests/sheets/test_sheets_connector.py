from __future__ import annotations

"""Tests for Google Sheets connector — CSV parsing, type inference, schema building."""
import os
import pytest
from packages.connectors.google_sheets import (
    parse_sheets_from_csv, build_schema_from_sheets,
    _sanitize_table_name, _sanitize_col_name, _infer_pg_type,
)


SAMPLE_CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "examples", "sample_indian_sales.csv")


@pytest.fixture
def csv_data():
    with open(SAMPLE_CSV_PATH, "r") as f:
        return parse_sheets_from_csv(f.read(), sheet_name="sales_data")


class TestCSVParser:
    def test_parses_one_tab(self, csv_data):
        assert len(csv_data.tabs) == 1
        assert csv_data.tabs[0].name == "sales_data"

    def test_correct_headers(self, csv_data):
        headers = csv_data.tabs[0].headers
        assert "Date" in headers
        assert "Customer" in headers
        assert "Total" in headers
        assert "GST Amount" in headers

    def test_correct_row_count(self, csv_data):
        assert csv_data.tabs[0].row_count == 15

    def test_first_row_data(self, csv_data):
        first_row = csv_data.tabs[0].rows[0]
        assert first_row[0] == "01/04/2025"  # Date
        assert first_row[1] == "Rajesh Kumar"  # Customer
        assert first_row[2] == "Mumbai"  # City

    def test_spreadsheet_title(self, csv_data):
        assert csv_data.spreadsheet_title == "sales_data"


class TestSchemaBuilder:
    def test_builds_schema(self, csv_data):
        schema = build_schema_from_sheets(csv_data, {"sheets_sales_data": 15})
        assert len(schema.tables) == 1
        assert schema.tables[0].name == "sheets_sales_data"

    def test_column_count(self, csv_data):
        schema = build_schema_from_sheets(csv_data, {"sheets_sales_data": 15})
        # Date, Customer, City, Product, Quantity, Unit Price, Total, Payment Mode, GST Amount, Invoice No
        assert len(schema.tables[0].columns) == 10

    def test_numeric_columns_detected(self, csv_data):
        schema = build_schema_from_sheets(csv_data, {"sheets_sales_data": 15})
        col_map = {c.name: c for c in schema.tables[0].columns}
        # Quantity, Unit Price, Total should be numeric
        assert "integer" in col_map["quantity"].data_type.lower() or "numeric" in col_map["quantity"].data_type.lower()
        assert "numeric" in col_map["total"].data_type.lower() or "integer" in col_map["total"].data_type.lower()

    def test_has_sample_values(self, csv_data):
        schema = build_schema_from_sheets(csv_data, {"sheets_sales_data": 15})
        customer_col = next(c for c in schema.tables[0].columns if c.name == "customer")
        assert len(customer_col.sample_values) > 0
        assert "Rajesh Kumar" in customer_col.sample_values


class TestHelpers:
    def test_sanitize_table_name(self):
        assert _sanitize_table_name("Sales Data 2025") == "sheets_sales_data_2025"
        assert _sanitize_table_name("Sheet1") == "sheets_sheet1"
        assert _sanitize_table_name("P&L Report!") == "sheets_p_l_report"

    def test_sanitize_col_name(self):
        assert _sanitize_col_name("Unit Price") == "unit_price"
        assert _sanitize_col_name("GST Amount (₹)") == "gst_amount"
        assert _sanitize_col_name("Date") == "date"

    def test_infer_numeric(self):
        assert "NUMERIC" in _infer_pg_type(["1000.50", "2500.00", "300.75"])
        assert _infer_pg_type(["100", "200", "300"]) == "INTEGER"

    def test_infer_date(self):
        assert _infer_pg_type(["2025-04-01", "2025-05-01"]) == "DATE"
        assert _infer_pg_type(["01/04/2025", "15/04/2025"]) == "DATE"

    def test_infer_text(self):
        assert _infer_pg_type(["Mumbai", "Delhi", "Chennai"]) == "TEXT"

    def test_infer_empty(self):
        assert _infer_pg_type(["", "", ""]) == "TEXT"

    def test_infer_inr_amounts(self):
        """Indian rupee amounts with commas — should be detected as numeric."""
        result = _infer_pg_type(["1,25,000", "50,000", "2,00,000"])
        assert "NUMERIC" in result or result == "INTEGER"

    def test_empty_csv(self):
        data = parse_sheets_from_csv("just_header\n")
        assert len(data.tabs) == 0 or data.tabs[0].row_count == 0

    def test_single_row_csv(self):
        data = parse_sheets_from_csv("Name,Amount\nTest,100\n")
        assert len(data.tabs) == 1
        assert data.tabs[0].row_count == 1