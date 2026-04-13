-- =============================================================================
-- BharatBI Sample Indian E-Commerce Dataset
-- Use this to seed a demo PostgreSQL database for testing and demos.
-- Covers: customers, products, orders, order_items, invoices (with GST)
-- All data is fictional. Indian cities, GSTIN format, HSN codes, INR values.
-- =============================================================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(15),
    city VARCHAR(50),
    state VARCHAR(50),
    pincode VARCHAR(6),
    gstin VARCHAR(15),
    customer_type VARCHAR(20) DEFAULT 'retail', -- retail, wholesale, b2b
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO customers (name, email, phone, city, state, pincode, gstin, customer_type) VALUES
('Rajesh Kumar', 'rajesh@example.com', '9876543210', 'Mumbai', 'Maharashtra', '400001', '27AABCU9603R1ZM', 'b2b'),
('Priya Sharma', 'priya@example.com', '9876543211', 'Delhi', 'Delhi', '110001', NULL, 'retail'),
('Amit Patel', 'amit@example.com', '9876543212', 'Ahmedabad', 'Gujarat', '380001', '24AABCU9603R1ZM', 'wholesale'),
('Sneha Reddy', 'sneha@example.com', '9876543213', 'Hyderabad', 'Telangana', '500001', NULL, 'retail'),
('Vikram Singh', 'vikram@example.com', '9876543214', 'Jaipur', 'Rajasthan', '302001', '08AABCU9603R1ZM', 'b2b'),
('Anita Desai', 'anita@example.com', '9876543215', 'Pune', 'Maharashtra', '411001', NULL, 'retail'),
('Suresh Iyer', 'suresh@example.com', '9876543216', 'Chennai', 'Tamil Nadu', '600001', '33AABCU9603R1ZM', 'b2b'),
('Kavita Nair', 'kavita@example.com', '9876543217', 'Kochi', 'Kerala', '682001', NULL, 'retail'),
('Manish Gupta', 'manish@example.com', '9876543218', 'Lucknow', 'Uttar Pradesh', '226001', '09AABCU9603R1ZM', 'wholesale'),
('Deepa Joshi', 'deepa@example.com', '9876543219', 'Bengaluru', 'Karnataka', '560001', '29AABCU9603R1ZM', 'b2b'),
('Rahul Mehta', 'rahul@example.com', '9876543220', 'Surat', 'Gujarat', '395001', NULL, 'retail'),
('Pooja Verma', 'pooja@example.com', '9876543221', 'Indore', 'Madhya Pradesh', '452001', NULL, 'retail'),
('Arjun Rao', 'arjun@example.com', '9876543222', 'Visakhapatnam', 'Andhra Pradesh', '530001', '37AABCU9603R1ZM', 'b2b'),
('Meera Pillai', 'meera@example.com', '9876543223', 'Thiruvananthapuram', 'Kerala', '695001', NULL, 'retail'),
('Nitin Agarwal', 'nitin@example.com', '9876543224', 'Kanpur', 'Uttar Pradesh', '208001', '09BBCDU1234R1ZM', 'wholesale');

-- Products (with HSN codes for GST)
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    hsn_code VARCHAR(8),
    price NUMERIC(12,2) NOT NULL,  -- MRP in INR
    gst_rate NUMERIC(4,2) DEFAULT 18.00,  -- GST percentage
    stock_qty INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, category, hsn_code, price, gst_rate, stock_qty) VALUES
('Laptop - ThinkPad E14', 'Electronics', '84713010', 55000.00, 18.00, 150),
('Wireless Mouse', 'Electronics', '84716060', 799.00, 18.00, 500),
('Office Chair - ErgoFlex', 'Furniture', '94013000', 12500.00, 18.00, 75),
('A4 Paper Ream (500 sheets)', 'Stationery', '48025610', 350.00, 12.00, 2000),
('Printer - LaserJet Pro', 'Electronics', '84433210', 18500.00, 18.00, 60),
('Desk Lamp LED', 'Furniture', '94054090', 1200.00, 18.00, 200),
('USB-C Hub 7-in-1', 'Electronics', '84733020', 2500.00, 18.00, 300),
('Whiteboard 4x3 ft', 'Stationery', '96101010', 3500.00, 18.00, 100),
('Webcam HD 1080p', 'Electronics', '85258090', 3200.00, 18.00, 180),
('Filing Cabinet 3-Drawer', 'Furniture', '94031090', 8500.00, 18.00, 40),
('Sticky Notes (Pack of 12)', 'Stationery', '48211010', 250.00, 12.00, 1500),
('Monitor 24" IPS', 'Electronics', '85285210', 14000.00, 18.00, 90),
('Keyboard Mechanical', 'Electronics', '84716050', 4500.00, 18.00, 250),
('Notebook Ruled (Pack of 5)', 'Stationery', '48201010', 450.00, 12.00, 800),
('Standing Desk Converter', 'Furniture', '94017900', 9500.00, 18.00, 35);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_date DATE NOT NULL,
    subtotal NUMERIC(12,2),  -- before GST
    gst_amount NUMERIC(12,2),
    total_amount NUMERIC(12,2),  -- subtotal + GST
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled, returned
    payment_mode VARCHAR(20), -- upi, card, netbanking, cod, cheque
    created_at TIMESTAMP DEFAULT NOW()
);

-- Generate orders across Indian FY 2025-26 (Apr 2025 – Mar 2026)
INSERT INTO orders (customer_id, order_date, subtotal, gst_amount, total_amount, status, payment_mode) VALUES
-- April 2025
(1, '2025-04-02', 55000.00, 9900.00, 64900.00, 'delivered', 'upi'),
(2, '2025-04-05', 1149.00, 206.82, 1355.82, 'delivered', 'card'),
(3, '2025-04-10', 125000.00, 22500.00, 147500.00, 'delivered', 'cheque'),
(5, '2025-04-15', 18500.00, 3330.00, 21830.00, 'delivered', 'netbanking'),
(4, '2025-04-20', 3500.00, 630.00, 4130.00, 'delivered', 'cod'),
-- May 2025
(6, '2025-05-03', 12500.00, 2250.00, 14750.00, 'delivered', 'upi'),
(7, '2025-05-08', 73500.00, 13230.00, 86730.00, 'delivered', 'netbanking'),
(8, '2025-05-12', 799.00, 143.82, 942.82, 'delivered', 'upi'),
(10, '2025-05-18', 42000.00, 7560.00, 49560.00, 'delivered', 'card'),
(9, '2025-05-25', 250000.00, 45000.00, 295000.00, 'delivered', 'cheque'),
-- June 2025
(1, '2025-06-01', 14000.00, 2520.00, 16520.00, 'delivered', 'upi'),
(11, '2025-06-05', 2500.00, 450.00, 2950.00, 'delivered', 'upi'),
(3, '2025-06-10', 95000.00, 17100.00, 112100.00, 'delivered', 'cheque'),
(12, '2025-06-15', 350.00, 42.00, 392.00, 'delivered', 'cod'),
(13, '2025-06-22', 37000.00, 6660.00, 43660.00, 'shipped', 'netbanking'),
-- July 2025
(2, '2025-07-01', 4500.00, 810.00, 5310.00, 'delivered', 'card'),
(5, '2025-07-08', 55000.00, 9900.00, 64900.00, 'delivered', 'netbanking'),
(14, '2025-07-12', 1200.00, 216.00, 1416.00, 'delivered', 'upi'),
(7, '2025-07-18', 18500.00, 3330.00, 21830.00, 'delivered', 'netbanking'),
(15, '2025-07-25', 175000.00, 31500.00, 206500.00, 'confirmed', 'cheque'),
-- August 2025
(1, '2025-08-02', 9500.00, 1710.00, 11210.00, 'delivered', 'upi'),
(10, '2025-08-08', 28000.00, 5040.00, 33040.00, 'delivered', 'card'),
(4, '2025-08-14', 55799.00, 10043.82, 65842.82, 'delivered', 'netbanking'),
(6, '2025-08-20', 3200.00, 576.00, 3776.00, 'shipped', 'upi'),
(8, '2025-08-28', 8500.00, 1530.00, 10030.00, 'pending', 'cod'),
-- September 2025
(3, '2025-09-03', 180000.00, 32400.00, 212400.00, 'delivered', 'cheque'),
(9, '2025-09-10', 14799.00, 2663.82, 17462.82, 'delivered', 'upi'),
(11, '2025-09-15', 55000.00, 9900.00, 64900.00, 'cancelled', 'card'),
(13, '2025-09-20', 4500.00, 810.00, 5310.00, 'delivered', 'upi'),
(2, '2025-09-28', 12500.00, 2250.00, 14750.00, 'returned', 'netbanking'),
-- October 2025 (Diwali season — higher sales)
(1, '2025-10-05', 110000.00, 19800.00, 129800.00, 'delivered', 'upi'),
(5, '2025-10-10', 85000.00, 15300.00, 100300.00, 'delivered', 'netbanking'),
(7, '2025-10-15', 45000.00, 8100.00, 53100.00, 'delivered', 'card'),
(10, '2025-10-18', 32500.00, 5850.00, 38350.00, 'delivered', 'upi'),
(3, '2025-10-22', 220000.00, 39600.00, 259600.00, 'delivered', 'cheque'),
(12, '2025-10-25', 15000.00, 2700.00, 17700.00, 'shipped', 'upi'),
(14, '2025-10-28', 7500.00, 1350.00, 8850.00, 'delivered', 'cod'),
-- November 2025
(6, '2025-11-02', 18500.00, 3330.00, 21830.00, 'delivered', 'upi'),
(8, '2025-11-08', 55000.00, 9900.00, 64900.00, 'delivered', 'netbanking'),
(15, '2025-11-15', 42000.00, 7560.00, 49560.00, 'pending', 'cheque'),
(4, '2025-11-20', 3500.00, 630.00, 4130.00, 'delivered', 'cod'),
(9, '2025-11-25', 95000.00, 17100.00, 112100.00, 'delivered', 'card'),
-- December 2025
(1, '2025-12-01', 28000.00, 5040.00, 33040.00, 'delivered', 'upi'),
(2, '2025-12-08', 14000.00, 2520.00, 16520.00, 'delivered', 'card'),
(13, '2025-12-12', 65000.00, 11700.00, 76700.00, 'shipped', 'netbanking'),
(7, '2025-12-18', 9500.00, 1710.00, 11210.00, 'delivered', 'upi'),
(11, '2025-12-22', 4500.00, 810.00, 5310.00, 'delivered', 'upi'),
-- January 2026
(3, '2026-01-05', 150000.00, 27000.00, 177000.00, 'delivered', 'cheque'),
(5, '2026-01-10', 18500.00, 3330.00, 21830.00, 'delivered', 'netbanking'),
(10, '2026-01-15', 55000.00, 9900.00, 64900.00, 'confirmed', 'card'),
(14, '2026-01-20', 1200.00, 216.00, 1416.00, 'delivered', 'upi'),
(6, '2026-01-28', 8500.00, 1530.00, 10030.00, 'delivered', 'cod'),
-- February 2026
(1, '2026-02-03', 42000.00, 7560.00, 49560.00, 'delivered', 'upi'),
(8, '2026-02-08', 12500.00, 2250.00, 14750.00, 'pending', 'netbanking'),
(9, '2026-02-15', 85000.00, 15300.00, 100300.00, 'delivered', 'cheque'),
(4, '2026-02-20', 3200.00, 576.00, 3776.00, 'delivered', 'upi'),
(12, '2026-02-25', 14000.00, 2520.00, 16520.00, 'delivered', 'card'),
-- March 2026 (FY end — closing rush)
(3, '2026-03-02', 280000.00, 50400.00, 330400.00, 'delivered', 'cheque'),
(7, '2026-03-08', 55000.00, 9900.00, 64900.00, 'delivered', 'netbanking'),
(5, '2026-03-12', 95000.00, 17100.00, 112100.00, 'delivered', 'card'),
(10, '2026-03-18', 32500.00, 5850.00, 38350.00, 'shipped', 'upi'),
(15, '2026-03-25', 125000.00, 22500.00, 147500.00, 'confirmed', 'cheque'),
(1, '2026-03-28', 18500.00, 3330.00, 21830.00, 'pending', 'upi');

-- Order Items (line items per order)
CREATE TABLE IF NOT EXISTS order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2),
    line_total NUMERIC(12,2)
);

INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES
(1, 1, 1, 55000.00, 55000.00),
(2, 2, 1, 799.00, 799.00),
(2, 11, 1, 350.00, 350.00),
(3, 1, 2, 55000.00, 110000.00),
(3, 12, 1, 14000.00, 14000.00),
(3, 2, 1, 799.00, 799.00),
(4, 5, 1, 18500.00, 18500.00),
(5, 8, 1, 3500.00, 3500.00),
(6, 3, 1, 12500.00, 12500.00),
(7, 1, 1, 55000.00, 55000.00),
(7, 5, 1, 18500.00, 18500.00),
(8, 2, 1, 799.00, 799.00),
(9, 12, 3, 14000.00, 42000.00),
(10, 1, 4, 55000.00, 220000.00),
(10, 7, 12, 2500.00, 30000.00);

-- Invoices (with GST breakup — CGST + SGST or IGST)
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    customer_gstin VARCHAR(15),
    place_of_supply VARCHAR(50),
    taxable_amount NUMERIC(12,2),
    cgst NUMERIC(12,2) DEFAULT 0,  -- Central GST (intra-state)
    sgst NUMERIC(12,2) DEFAULT 0,  -- State GST (intra-state)
    igst NUMERIC(12,2) DEFAULT 0,  -- Integrated GST (inter-state)
    total_amount NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO invoices (order_id, invoice_number, invoice_date, customer_gstin, place_of_supply, taxable_amount, cgst, sgst, igst, total_amount) VALUES
(1, 'INV-2025-001', '2025-04-02', '27AABCU9603R1ZM', 'Maharashtra', 55000.00, 4950.00, 4950.00, 0, 64900.00),
(3, 'INV-2025-002', '2025-04-10', '24AABCU9603R1ZM', 'Gujarat', 125000.00, 0, 0, 22500.00, 147500.00),
(7, 'INV-2025-003', '2025-05-08', '33AABCU9603R1ZM', 'Tamil Nadu', 73500.00, 0, 0, 13230.00, 86730.00),
(10, 'INV-2025-004', '2025-05-25', '09AABCU9603R1ZM', 'Uttar Pradesh', 250000.00, 0, 0, 45000.00, 295000.00),
(13, 'INV-2025-005', '2025-06-10', '24AABCU9603R1ZM', 'Gujarat', 95000.00, 0, 0, 17100.00, 112100.00);

-- Useful views for Indian business queries
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
    DATE_TRUNC('month', order_date)::DATE AS month,
    COUNT(*) AS order_count,
    SUM(subtotal) AS revenue,
    SUM(gst_amount) AS gst_collected,
    SUM(total_amount) AS total_with_gst
FROM orders
WHERE status NOT IN ('cancelled', 'returned')
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW customer_summary AS
SELECT
    c.customer_id, c.name, c.city, c.state, c.customer_type,
    COUNT(o.order_id) AS total_orders,
    SUM(o.total_amount) AS lifetime_value,
    MAX(o.order_date) AS last_order_date
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id AND o.status NOT IN ('cancelled', 'returned')
GROUP BY c.customer_id, c.name, c.city, c.state, c.customer_type;

CREATE OR REPLACE VIEW gst_summary AS
SELECT
    DATE_TRUNC('month', invoice_date)::DATE AS month,
    SUM(taxable_amount) AS total_taxable,
    SUM(cgst) AS total_cgst,
    SUM(sgst) AS total_sgst,
    SUM(igst) AS total_igst,
    SUM(cgst + sgst + igst) AS total_gst
FROM invoices
GROUP BY 1
ORDER BY 1;