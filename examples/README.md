# Sample Indian E-Commerce Dataset

This is a fictional Indian e-commerce dataset designed for testing and demos of CueBI.

## What's inside

| Table | Rows | Description |
|-------|------|-------------|
| `customers` | 15 | Indian customers across 15 cities with GSTIN, pincode, customer type |
| `products` | 15 | Office/electronics products with HSN codes, MRP in ₹, GST rates |
| `orders` | 60 | Orders across FY 2025-26 (Apr 2025 – Mar 2026) with GST, payment modes |
| `order_items` | 15 | Line items linking orders to products |
| `invoices` | 5 | GST invoices with CGST/SGST/IGST breakup |

## Views (pre-built)

- `monthly_revenue` — monthly order count, revenue, GST collected
- `customer_summary` — lifetime value, order count per customer
- `gst_summary` — month-wise GST breakup (CGST/SGST/IGST)

## India-specific features

- **GSTIN** numbers in correct format (state code prefix)
- **HSN codes** for GST classification
- **CGST + SGST** (intra-state) vs **IGST** (inter-state) split
- **Payment modes**: UPI, card, netbanking, COD, cheque
- **Indian cities**: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Jaipur, etc.
- **FY 2025-26**: April 2025 to March 2026 (Indian fiscal year)
- **Diwali spike**: October has higher order values (festive season)
- **March closing rush**: FY-end bulk orders

## How to load

```bash
# If using the CueBI docker-compose:
docker exec -i cuebi-postgres psql -U cuebi -d cuebi_demo < examples/sample_indian_ecommerce.sql

# Or standalone:
psql -h localhost -U youruser -d yourdb < examples/sample_indian_ecommerce.sql
```

## Sample questions to test

1. "Total sales this financial year"
2. "Top 5 customers by revenue"
3. "Monthly revenue trend"
4. "GST collected last quarter"
5. "Which payment mode is most popular?"
6. "City-wise order distribution"
7. "Average order value by customer type"
8. "Products with highest sales"
9. "Show me MoM revenue growth"
10. "How much IGST vs CGST+SGST did we collect?"