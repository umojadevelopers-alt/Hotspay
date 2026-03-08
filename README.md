# Hotspay – MikroTik Hotspot Billing System

> A full-featured, self-hosted billing and management system for MikroTik Hotspot networks. Manage vouchers, customers, payments (Cash, M-Pesa, PayPal), session logs, and live router stats — all from a clean Bootstrap 5 dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://mysql.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- 🎟 **Voucher Management** – Generate, print, and push vouchers to MikroTik
- 👥 **Customer Management** – Track customers and their session history
- 💳 **Multi-Payment Support** – Cash, M-Pesa STK Push, PayPal
- 📡 **MikroTik Integration** – RouterOS API: sync users, profiles, active sessions
- 📊 **Reports & Analytics** – Revenue charts, bandwidth usage, PDF/Excel/CSV exports
- 🌐 **Hotspot Portal** – Custom branded login page for end-users
- 🛒 **Self-Service Portal** – Customers can check balance and buy vouchers
- 🔐 **Role-Based Access** – `super_admin`, `cashier`, `viewer` roles
- 🌍 **Multi-Language** – English, Swahili, French (i18next)
- 🌙 **Dark / Light Mode** – Persisted per-browser
- 🐳 **Docker Ready** – Single `docker compose up` deployment

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.x |
| MySQL | 8.x |
| MikroTik RouterOS | 6.x / 7.x (API enabled) |
| npm | ≥ 9.x |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourorg/Hotspay.git
cd Hotspay
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your database, JWT, MikroTik, and payment credentials
```

Key variables to set:

```env
DB_HOST=localhost
DB_USER=hotspay_user
DB_PASSWORD=your_password
DB_NAME=hotspay

JWT_SECRET=change_this_to_a_long_random_secret_at_least_32_chars

MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=api_user
MIKROTIK_PASSWORD=api_password
```

### 4. Set up the database

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p hotspay < database/seed.sql
```

### 5. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Open **http://localhost:3000** in your browser.

**Default login:** `admin@hotspay.local` / `Admin@123`

---

## MikroTik RouterOS Setup

### Enable the API

```routeros
/ip service set api disabled=no port=8728
```

For TLS (recommended in production):

```routeros
/ip service set api-ssl disabled=no port=8729
```

### Create an API user

```routeros
/user group add name=hotspay_api policy=api,read,write,!local,!telnet,!ssh,!ftp,!reboot,!policy,!test,!winbox,!password,!web,!sniff,!sensitive,!romon
/user add name=hotspay password=StrongPassword group=hotspay_api
```

### Configure Hotspot login page (optional)

To use Hotspay's custom login page, set your MikroTik hotspot login URL to:

```
http://YOUR_SERVER_IP:3000/hotspot-login?link-login=$(link-login)&link-orig=$(link-orig)
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment (`development`/`production`) |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `hotspay` | Database name |
| `DB_USER` | – | MySQL user |
| `DB_PASSWORD` | – | MySQL password |
| `DB_CONNECTION_LIMIT` | `10` | Connection pool size |
| `JWT_SECRET` | – | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | `24h` | Token expiry |
| `MIKROTIK_HOST` | `192.168.88.1` | Default router IP |
| `MIKROTIK_PORT` | `8728` | RouterOS API port |
| `MIKROTIK_USER` | `admin` | RouterOS API user |
| `MIKROTIK_PASSWORD` | – | RouterOS API password |
| `MIKROTIK_TLS` | `false` | Use TLS for API |
| `MPESA_CONSUMER_KEY` | – | Safaricom Daraja consumer key |
| `MPESA_CONSUMER_SECRET` | – | Safaricom Daraja consumer secret |
| `MPESA_SHORTCODE` | `174379` | M-Pesa shortcode/till |
| `MPESA_PASSKEY` | – | M-Pesa passkey |
| `MPESA_CALLBACK_URL` | – | Public callback URL |
| `MPESA_ENV` | `sandbox` | `sandbox` or `production` |
| `SMTP_HOST` | – | SMTP server for email |
| `SMTP_USER` | – | SMTP username |
| `SMTP_PASSWORD` | – | SMTP password |
| `AT_API_KEY` | – | Africa's Talking API key |
| `AT_USERNAME` | `sandbox` | Africa's Talking username |
| `SMS_ENABLED` | `false` | Enable SMS notifications |
| `EMAIL_ENABLED` | `false` | Enable email notifications |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `RATE_LIMIT_MAX` | `100` | Requests per window |
| `ALLOWED_IPS` | *(empty)* | IP whitelist for API |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `DEFAULT_LANGUAGE` | `en` | Default language (`en`/`sw`/`fr`) |

---

## Database Setup

Schema and seed files are in the `database/` directory.

```bash
# Create schema
mysql -u root -p < database/schema.sql

# Insert sample data (includes default super_admin user)
mysql -u root -p hotspay < database/seed.sql
```

### Tables

| Table | Description |
|---|---|
| `admin_users` | System users with roles |
| `routers` | MikroTik router credentials |
| `profiles` | Hotspot service packages |
| `customers` | End-user customer records |
| `vouchers` | Generated voucher credentials |
| `transactions` | Payment records |
| `session_logs` | Hotspot session history |

---

## Docker Deployment

### Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2.20

### Start all services

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your secrets

# Build and start
docker compose up -d

# View logs
docker compose logs -f app
```

### Services

| Service | Port | Description |
|---|---|---|
| `app` | `3000` | Hotspay Node.js application |
| `mysql` | `3306` | MySQL 8 database |
| `phpmyadmin` | `8080` | phpMyAdmin web interface |

The database schema and seed data are automatically applied on first run via Docker's `docker-entrypoint-initdb.d` mechanism.

### Stop services

```bash
docker compose down

# Remove volumes (⚠️ deletes all data)
docker compose down -v
```

---

## Frontend Pages

| URL | File | Auth | Description |
|---|---|---|---|
| `/login` | `login.html` | No | Admin login |
| `/` | `index.html` | ✅ | Main dashboard with charts & stats |
| `/customers.html` | `customers.html` | ✅ | Customer CRUD + session history |
| `/vouchers.html` | `vouchers.html` | ✅ | Voucher generation, push, print |
| `/payments.html` | `payments.html` | ✅ | Cash, M-Pesa, PayPal payments |
| `/reports.html` | `reports.html` | ✅ | Analytics, export PDF/Excel/CSV |
| `/routers.html` | `routers.html` | ✅ | Router management & health stats |
| `/hotspot-login` | `hotspot-login.html` | No | MikroTik hotspot portal |
| `/self-service` | `self-service.html` | No | Customer self-service portal |

---

## API Endpoints Reference

All protected endpoints require `Authorization: Bearer <token>` header.

Role hierarchy: `super_admin` > `cashier` > `viewer`

### Authentication (`/api/auth`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login, returns JWT |
| `POST` | `/api/auth/register` | Public (first user) / `super_admin` | Register user |
| `POST` | `/api/auth/logout` | Any | Logout (client discards token) |
| `GET` | `/api/auth/me` | Any | Get current user info |
| `PUT` | `/api/auth/me/password` | Any | Change own password |
| `GET` | `/api/auth/users` | `super_admin` | List all users |
| `PUT` | `/api/auth/users/:id` | `super_admin` | Update user |
| `DELETE` | `/api/auth/users/:id` | `super_admin` | Delete user |

### Customers (`/api/customers`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/customers` | `viewer` | List customers (filterable) |
| `POST` | `/api/customers` | `cashier` | Create customer |
| `GET` | `/api/customers/:id` | `viewer` | Get customer details |
| `PUT` | `/api/customers/:id` | `cashier` | Update customer |
| `DELETE` | `/api/customers/:id` | `super_admin` | Delete customer |
| `GET` | `/api/customers/:id/sessions` | `viewer` | Get customer sessions |
| `GET` | `/api/customers/:id/vouchers` | `viewer` | Get customer vouchers |

### Vouchers (`/api/vouchers`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/vouchers` | `viewer` | List vouchers (filterable) |
| `POST` | `/api/vouchers/generate` | `cashier` | Batch-generate vouchers |
| `GET` | `/api/vouchers/pdf` | `viewer` | Export vouchers as PDF |
| `POST` | `/api/vouchers/sync` | `cashier` | Sync vouchers from MikroTik |
| `GET` | `/api/vouchers/:id` | `viewer` | Get voucher details |
| `DELETE` | `/api/vouchers/:id` | `super_admin` | Delete voucher |
| `GET` | `/api/vouchers/:id/qr` | `viewer` | Get voucher QR code |
| `POST` | `/api/vouchers/:id/push` | `cashier` | Push voucher to MikroTik |

### Payments (`/api/payments`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/payments` | `viewer` | List transactions |
| `POST` | `/api/payments/cash` | `cashier` | Record cash payment |
| `POST` | `/api/payments/mpesa/initiate` | `cashier` | Initiate M-Pesa STK Push |
| `POST` | `/api/payments/mpesa/callback` | Public | M-Pesa payment callback |
| `POST` | `/api/payments/paypal/create-order` | `cashier` | Create PayPal order |
| `POST` | `/api/payments/paypal/capture` | `cashier` | Capture PayPal payment |
| `GET` | `/api/payments/:id` | `viewer` | Get transaction details |
| `GET` | `/api/payments/:id/receipt` | `viewer` | Download PDF receipt |

### Routers (`/api/routers`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/routers` | `viewer` | List routers |
| `POST` | `/api/routers` | `super_admin` | Add router |
| `GET` | `/api/routers/:id` | `viewer` | Get router details |
| `PUT` | `/api/routers/:id` | `super_admin` | Update router |
| `DELETE` | `/api/routers/:id` | `super_admin` | Delete router |
| `POST` | `/api/routers/:id/test` | `viewer` | Test router connection |

### Hotspot / MikroTik (`/api/hotspot`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/hotspot/:routerId/users` | `viewer` | List hotspot users |
| `POST` | `/api/hotspot/:routerId/users` | `cashier` | Add hotspot user |
| `DELETE` | `/api/hotspot/:routerId/users/:username` | `super_admin` | Remove user |
| `POST` | `/api/hotspot/:routerId/users/:username/disable` | `cashier` | Disable user |
| `POST` | `/api/hotspot/:routerId/users/:username/enable` | `cashier` | Enable user |
| `GET` | `/api/hotspot/:routerId/sessions` | `viewer` | List active sessions |
| `DELETE` | `/api/hotspot/:routerId/sessions/:sessionId` | `cashier` | Disconnect session |
| `GET` | `/api/hotspot/:routerId/health` | `viewer` | Router health stats |
| `GET` | `/api/hotspot/:routerId/interfaces` | `viewer` | List interfaces |
| `POST` | `/api/hotspot/:routerId/sync` | `cashier` | Sync profiles & users |

### Profiles (`/api/profiles`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/profiles` | `viewer` | List profiles |
| `POST` | `/api/profiles` | `cashier` | Create profile |
| `GET` | `/api/profiles/:id` | `viewer` | Get profile details |
| `PUT` | `/api/profiles/:id` | `cashier` | Update profile |
| `DELETE` | `/api/profiles/:id` | `super_admin` | Delete profile |
| `POST` | `/api/profiles/:id/push` | `cashier` | Push profile to MikroTik |

### Reports (`/api/reports`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/reports/dashboard` | `viewer` | Dashboard summary stats |
| `GET` | `/api/reports/revenue` | `viewer` | Revenue over time |
| `GET` | `/api/reports/users` | `viewer` | New users per day |
| `GET` | `/api/reports/sessions` | `viewer` | Session history |
| `GET` | `/api/reports/bandwidth` | `viewer` | Bandwidth per user |
| `GET` | `/api/reports/export/pdf` | `viewer` | Export report as PDF |
| `GET` | `/api/reports/export/excel` | `viewer` | Export report as Excel |
| `GET` | `/api/reports/export/csv` | `viewer` | Export report as CSV |

### SMS (`/api/sms`)

Used internally to send voucher credentials to customers via Africa's Talking.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Client Browser                       │
│   Bootstrap 5 SPA  ◄──── JWT ────►  Fetch API            │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼─────────────────────────────┐
│                   Express.js (Node 18)                    │
│  Helmet │ CORS │ Rate Limit │ Passport-JWT │ i18next      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │  Routes  │  │ Services  │  │   Static Files /pub  │  │
│  └────┬─────┘  └─────┬─────┘  └──────────────────────┘  │
│       │              │                                    │
│  ┌────▼──────────────▼──────────────┐                    │
│  │       Models (mysql2 pool)        │                    │
│  └────────────────┬─────────────────┘                    │
└───────────────────┼──────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────┐
│                    MySQL 8 Database                        │
│  admin_users │ routers │ profiles │ customers             │
│  vouchers    │ transactions │ session_logs                │
└──────────────────────────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────┐
│              MikroTik RouterOS (API port 8728)            │
│  Hotspot users │ Active sessions │ Profiles               │
└──────────────────────────────────────────────────────────┘
```

---

## Development

```bash
# Run in development mode (nodemon)
npm run dev

# Check environment
node -e "require('dotenv').config(); console.log(process.env.DB_HOST)"
```

The app serves static files from `public/` and all admin pages require a valid JWT stored in `localStorage.getItem('token')`.

---

## Security Notes

- Change `JWT_SECRET` and `JWT_REFRESH_SECRET` before production deployment
- Use strong database passwords
- Enable `ALLOWED_IPS` to restrict API access if running on a public server
- Use HTTPS in production (nginx/Caddy reverse proxy recommended)
- The MikroTik API user should have the minimum required permissions
- bcrypt rounds default to 12; increase for higher security at the cost of login speed

---

## License

MIT © 2024 Hotspay Contributors
