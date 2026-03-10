-- Hotspay Database Schema
-- MikroTik Hotspot Billing System

CREATE DATABASE IF NOT EXISTS hotspay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotspay;

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'cashier', 'viewer') DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- MikroTik Routers
CREATE TABLE IF NOT EXISTS routers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    host VARCHAR(100) NOT NULL,
    api_user VARCHAR(100) NOT NULL,
    api_password VARCHAR(255) NOT NULL,
    api_port INT DEFAULT 8728,
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Hotspot Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id INT,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    duration VARCHAR(20),
    data_limit VARCHAR(20),
    speed_up VARCHAR(20),
    speed_down VARCHAR(20),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL,
    profile_id INT,
    router_id INT,
    amount DECIMAL(10,2) DEFAULT 0.00,
    is_used BOOLEAN DEFAULT FALSE,
    is_expired BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NULL,
    used_at TIMESTAMP NULL,
    customer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NULL,
    customer_id INT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'mpesa', 'paypal') NOT NULL,
    payment_reference VARCHAR(100),
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    receipt_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Session Logs
CREATE TABLE IF NOT EXISTS session_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id INT,
    username VARCHAR(50),
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    bytes_in BIGINT DEFAULT 0,
    bytes_out BIGINT DEFAULT 0,
    uptime VARCHAR(50),
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP NULL,
    FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
);

-- WireGuard Server Config
CREATE TABLE IF NOT EXISTS wireguard_server (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_endpoint VARCHAR(100) NOT NULL,
    server_port INT DEFAULT 51820,
    private_key VARCHAR(100),
    public_key VARCHAR(100),
    network_address VARCHAR(50) DEFAULT '10.10.10.0/24',
    server_ip VARCHAR(50) DEFAULT '10.10.10.1',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- WireGuard Peers (Routers)
CREATE TABLE IF NOT EXISTS wireguard_peers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id INT,
    peer_name VARCHAR(100) NOT NULL,
    public_key VARCHAR(100),
    wireguard_ip VARCHAR(50) NOT NULL,
    lan_network VARCHAR(50),
    listen_port INT DEFAULT 13231,
    status ENUM('pending', 'connected', 'disconnected') DEFAULT 'pending',
    last_handshake TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL
);
