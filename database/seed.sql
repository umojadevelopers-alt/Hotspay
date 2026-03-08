-- Hotspay Seed Data
-- Run after schema.sql

USE hotspay;

-- Default super_admin user: admin@hotspay.local / Admin@123
INSERT INTO admin_users (name, email, password, role, is_active)
VALUES (
    'Super Admin',
    'admin@hotspay.local',
    '$2a$12$bi1e3iOgzRoahNW09G91LO6yW9lkuYk1DqOQB5PCiWJkiNfYFhktm',
    'super_admin',
    TRUE
) ON DUPLICATE KEY UPDATE id=id;

-- Sample cashier user: cashier@hotspay.local / Cashier@123
INSERT INTO admin_users (name, email, password, role, is_active)
VALUES (
    'Demo Cashier',
    'cashier@hotspay.local',
    '$2a$12$bi1e3iOgzRoahNW09G91LO6yW9lkuYk1DqOQB5PCiWJkiNfYFhktm',
    'cashier',
    TRUE
) ON DUPLICATE KEY UPDATE id=id;

-- Sample MikroTik Router
INSERT INTO routers (name, host, api_user, api_password, api_port, location, is_active)
VALUES (
    'Main Router',
    '192.168.88.1',
    'admin',
    'admin',
    8728,
    'Head Office',
    TRUE
) ON DUPLICATE KEY UPDATE id=id;

-- Sample Hotspot Profiles
INSERT INTO profiles (router_id, name, display_name, duration, data_limit, speed_up, speed_down, price)
VALUES
    (1, '1hr',   '1 Hour',    '1h',   NULL,    '2M',  '2M',  20.00),
    (1, '3hr',   '3 Hours',   '3h',   NULL,    '2M',  '2M',  50.00),
    (1, '24hr',  '1 Day',     '24h',  NULL,    '5M',  '5M',  100.00),
    (1, '7day',  '1 Week',    '168h', NULL,    '5M',  '5M',  500.00),
    (1, '30day', '1 Month',   '720h', '10GB',  '10M', '10M', 1500.00);

-- Sample Customers
INSERT INTO customers (name, phone, email)
VALUES
    ('John Doe',    '+254700000001', 'john@example.com'),
    ('Jane Smith',  '+254700000002', 'jane@example.com'),
    ('Ali Hassan',  '+254700000003', NULL),
    ('Mary Wanjiku', '+254700000004', 'mary@example.com'),
    ('Peter Omondi', '+254700000005', NULL);

-- Sample Vouchers (unused)
INSERT INTO vouchers (username, password, profile_id, router_id, amount, is_used, is_expired)
VALUES
    ('HSP-001', 'pass001', 1, 1, 20.00,  FALSE, FALSE),
    ('HSP-002', 'pass002', 1, 1, 20.00,  FALSE, FALSE),
    ('HSP-003', 'pass003', 2, 1, 50.00,  FALSE, FALSE),
    ('HSP-004', 'pass004', 3, 1, 100.00, FALSE, FALSE),
    ('HSP-005', 'pass005', 3, 1, 100.00, TRUE,  FALSE),
    ('HSP-006', 'pass006', 4, 1, 500.00, FALSE, FALSE);

-- Sample Transactions
INSERT INTO transactions (voucher_id, customer_id, amount, payment_method, payment_reference, status, receipt_number, notes)
VALUES
    (5, 1, 100.00, 'cash',  NULL,             'completed', 'RCP-001', 'Walk-in customer'),
    (1, 2, 20.00,  'mpesa', 'MPE20240101001', 'completed', 'RCP-002', NULL),
    (3, 3, 50.00,  'cash',  NULL,             'completed', 'RCP-003', NULL),
    (4, 4, 100.00, 'paypal','PP20240101001',  'completed', 'RCP-004', NULL),
    (2, 5, 20.00,  'mpesa', 'MPE20240102001', 'pending',   NULL,      'Awaiting confirmation');

-- Sample Session Logs
INSERT INTO session_logs (router_id, username, ip_address, mac_address, bytes_in, bytes_out, uptime, login_at, logout_at)
VALUES
    (1, 'HSP-005', '192.168.88.10', 'AA:BB:CC:DD:EE:01', 104857600, 52428800,  '1h30m', NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 90 MINUTE),
    (1, 'HSP-001', '192.168.88.11', 'AA:BB:CC:DD:EE:02', 20971520,  10485760,  '45m',   NOW() - INTERVAL 1 HOUR, NULL),
    (1, 'HSP-002', '192.168.88.12', 'AA:BB:CC:DD:EE:03', 5242880,   2621440,   '12m',   NOW() - INTERVAL 15 MINUTE, NULL);
