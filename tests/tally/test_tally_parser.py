from __future__ import annotations

"""Tests for Tally XML and Excel parser."""
import os
import pytest
from packages.connectors.tally.parser import parse_tally_xml, TallyData, _safe_float
from packages.connectors.tally.staging import _parse_tally_date


SAMPLE_XML_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "examples", "sample_tally_export.xml")


@pytest.fixture
def tally_data() -> TallyData:
    with open(SAMPLE_XML_PATH, "rb") as f:
        return parse_tally_xml(f.read())


class TestTallyXMLParser:
    def test_parses_company_name(self, tally_data):
        assert tally_data.company_name == "Sharma Electronics Pvt Ltd"

    def test_parses_ledgers(self, tally_data):
        assert len(tally_data.ledgers) == 5
        names = [l.name for l in tally_data.ledgers]
        assert "Cash A/c" in names
        assert "HDFC Bank" in names
        assert "Rajesh Traders" in names

    def test_ledger_balances(self, tally_data):
        cash = next(l for l in tally_data.ledgers if "Cash" in l.name)
        assert cash.opening_balance == 50000.0
        assert cash.closing_balance == 125000.0

    def test_ledger_gstin(self, tally_data):
        rajesh = next(l for l in tally_data.ledgers if "Rajesh" in l.name)
        assert rajesh.gstin == "27AABCR1234R1ZM"
        assert rajesh.state == "Maharashtra"

    def test_ledger_parent_group(self, tally_data):
        hdfc = next(l for l in tally_data.ledgers if "HDFC" in l.name)
        assert hdfc.parent_group == "Bank Accounts"

    def test_parses_stock_items(self, tally_data):
        assert len(tally_data.stock_items) == 3
        names = [s.name for s in tally_data.stock_items]
        assert "Samsung Galaxy S24" in names
        assert "iPhone 15" in names
        assert "USB-C Cable" in names

    def test_stock_item_details(self, tally_data):
        samsung = next(s for s in tally_data.stock_items if "Samsung" in s.name)
        assert samsung.unit == "Nos"
        assert samsung.opening_qty == 50.0
        assert samsung.opening_value == 2500000.0
        assert samsung.hsn_code == "85171210"

    def test_parses_vouchers(self, tally_data):
        assert len(tally_data.vouchers) == 4
        types = [v.voucher_type for v in tally_data.vouchers]
        assert "Sales" in types
        assert "Purchase" in types
        assert "Receipt" in types
        assert "Payment" in types

    def test_voucher_details(self, tally_data):
        sales = next(v for v in tally_data.vouchers if v.voucher_type == "Sales")
        assert sales.voucher_number == "S-001"
        assert sales.party_name == "Rajesh Traders"
        assert sales.date == "20250415"
        assert "Samsung Galaxy S24" in sales.narration

    def test_voucher_ledger_entries(self, tally_data):
        sales = next(v for v in tally_data.vouchers if v.voucher_type == "Sales")
        assert len(sales.ledger_entries) == 4  # Rajesh + Sales + CGST + SGST
        ledger_names = [e["ledger_name"] for e in sales.ledger_entries]
        assert "CGST" in ledger_names
        assert "SGST" in ledger_names

    def test_voucher_inventory_entries(self, tally_data):
        sales = next(v for v in tally_data.vouchers if v.voucher_type == "Sales")
        assert len(sales.inventory_entries) == 1
        assert sales.inventory_entries[0]["stock_item"] == "Samsung Galaxy S24"
        assert sales.inventory_entries[0]["quantity"] == 5.0


class TestHelpers:
    def test_safe_float_normal(self):
        assert _safe_float("12500.50") == 12500.50

    def test_safe_float_with_commas(self):
        assert _safe_float("1,25,000.50") == 125000.50

    def test_safe_float_with_dr(self):
        assert _safe_float("50000 Dr") == 50000.0

    def test_safe_float_with_cr(self):
        assert _safe_float("50000 Cr") == -50000.0

    def test_safe_float_empty(self):
        assert _safe_float("") == 0.0
        assert _safe_float(None) == 0.0

    def test_parse_date_yyyymmdd(self):
        assert _parse_tally_date("20250415") == "2025-04-15"

    def test_parse_date_dd_mm_yyyy(self):
        assert _parse_tally_date("15-04-2025") == "2025-04-15"

    def test_parse_date_dd_slash_mm_slash_yyyy(self):
        assert _parse_tally_date("15/04/2025") == "2025-04-15"

    def test_parse_date_empty(self):
        assert _parse_tally_date("") is None