# 🚀 XENI AI — Autonomous E-Commerce Command Center

An autonomous AI-powered e-commerce and F-commerce operating system built for the Bangladeshi market. XENI automates Facebook Messenger conversations, order processing with bKash/Nagad payment verification, inventory management, AI content creation, and sales intelligence — all in Bangla and English.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│             XENI AI — E-Commerce Command Center                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│    Facebook                                                         │
│    Messenger ──▶ Meta Webhook                                       │
│                      │                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────────┐  │
│  │ Next.js  │───▶│  Nginx   │───▶│      Go API Gateway          │  │
│  │ Frontend │    │  Proxy   │    │  (Fiber v2 + GORM)           │  │
│  │  :3000   │    │   :80    │    │  :8080                       │  │
│  └──────────┘    └──────────┘    └──────┬───┬───┬───────────────┘  │
│                                         │   │   │                   │
│                           ┌─────────────┘   │   └────────────┐     │
│                           ▼                 ▼                ▼     │
│                    ┌───────────┐    ┌──────────┐    ┌──────────┐   │
│                    │ PostgreSQL│    │  Redis   │    │ RabbitMQ │   │
│                    │   :5432   │    │  :6379   │    │  :5672   │   │
│                    └───────────┘    └──────────┘    └────┬─────┘   │
│                                                          │         │
│      ┌──────────────┬──────────────┬────────────┬───────┤         │
│      ▼              ▼              ▼            ▼       ▼         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │Converstn │ │  Order   │ │Inventory │ │ Creative │ │  Intel   ││
│ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   ││
│ │  :8001   │ │  :8002   │ │  :8003   │ │  :8004   │ │  :8005   ││
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│
│      │             │            │             │            │      │
│      └─────────────┴──────┬─────┴─────────────┴────────────┘      │
│                           ▼                                       │
│                    ┌───────────┐                                   │
│                    │  MongoDB  │                                   │
│                    │  :27017   │                                   │
│                    └───────────┘                                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Observability: Prometheus :9090  │  Grafana :3001            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service Port Map

| Service | Port | URL |
|---|---|---|
| **Nginx** (Reverse Proxy) | 80 | http://localhost |
| **Next.js** (Frontend) | 3000 | http://localhost:3000 |
| **Go Gateway** (API) | 8080 | http://localhost:8080 |
| **PostgreSQL** | 5432 | — |
| **MongoDB** | 27017 | — |
| **Redis** | 6379 | — |
| **RabbitMQ** (AMQP) | 5672 | — |
| **RabbitMQ** (Management) | 15672 | http://localhost:15672 |
| **Prometheus** | 9090 | http://localhost:9090 |
| **Grafana** | 3001 | http://localhost:3001 |
| **Worker: Conversation** | 8001 | http://localhost:8001/docs |
| **Worker: Order** | 8002 | http://localhost:8002/docs |
| **Worker: Inventory** | 8003 | http://localhost:8003/docs |
| **Worker: Creative** | 8004 | http://localhost:8004/docs |
| **Worker: Intelligence** | 8005 | http://localhost:8005/docs |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Framer Motion, next-intl |
| API Gateway | Go (Fiber v2), GORM, golang-jwt, amqp091-go |
| AI Workers | Python 3.11, FastAPI, LangChain / CrewAI |
| Primary DB | PostgreSQL 16 (14 tables — shops, orders, products, conversations, etc.) |
| Document DB | MongoDB 7 (4 collections — conversation/order/creative/intelligence outputs) |
| Cache | Redis 7 |
| Message Broker | RabbitMQ 3.13 |
| Payments | SSLCommerz (BDT subscription billing) |
| MFS Detection | bKash & Nagad API verification |
| Couriers | Pathao, Steadfast |
| Messenger | Meta Graph API + Webhook |
| i18n | next-intl (English + বাংলা) |
| Monitoring | Prometheus + Grafana |

---

## Quick Start

### Prerequisites
- **Docker** & **Docker Compose** v2+ installed
- Ports 80, 3000, 3001, 5432, 5672, 6379, 8080, 9090, 15672, 27017 available

### 1. Clone & Configure

```bash
git clone <repo-url> && cd Xeni-Agent
cp .env.example .env
cp gateway/.env.example gateway/.env
cp frontend/.env.example frontend/.env.local
cp workers/.env.example workers/.env
```

### 2. Start Infrastructure Only

```bash
docker compose up -d
```

This starts: PostgreSQL, MongoDB, Redis, RabbitMQ, Prometheus, Grafana.
Application services are behind the `app` profile and won't start yet.

### 3. Verify Infrastructure

```bash
# Check all services are healthy
docker compose ps

# RabbitMQ Management UI
open http://localhost:15672  # xeni / xeni_secret

# Grafana
open http://localhost:3001   # admin / admin

# PostgreSQL — verify schema
docker compose exec postgres psql -U xeni -d xeni_db -c "\dt"
```

### 4. Start Everything (after building app services)

```bash
docker compose --profile app up -d
```

---

## Project Structure

```
Xeni-Agent/
├── docker-compose.yml         # All services
├── .env.example               # Infrastructure env vars
├── README.md
│
├── frontend/                  # Next.js 14 (bilingual UI)
│   ├── .env.example
│   └── src/
│       └── app/[locale]/      # i18n routing (en / bn)
│
├── gateway/                   # Go Fiber API Gateway
│   ├── .env.example
│   └── internal/
│       ├── handlers/          # Route handlers
│       ├── middleware/         # Auth, rate limiting
│       └── services/          # Business logic
│
├── workers/                   # Python AI Workers (5 agents)
│   ├── .env.example
│   └── app/
│       ├── agents/            # Per-agent logic
│       └── shared/            # Shared utilities
│
├── infra/
│   ├── postgres/
│   │   └── init.sql           # 14-table DDL + seed data
│   ├── mongo/
│   │   └── init.js            # 4 domain-specific collections
│   ├── rabbitmq/
│   │   ├── rabbitmq.conf
│   │   └── definitions.json   # Exchange/queue topology
│   ├── nginx/
│   │   └── nginx.conf         # Reverse proxy + Messenger webhook
│   ├── prometheus/
│   │   └── prometheus.yml     # Scrape targets
│   └── grafana/
│       └── provisioning/
│           └── datasources/
│               └── datasource.yml
│
└── scripts/
    └── wait-for-it.sh         # TCP readiness checker
```

---

## AI Agents (5 E-Commerce Agents)

| Agent | Description | Key Features |
|---|---|---|
| 💬 **Conversation** | Messenger auto-reply | Intent detection, product inquiry, order status, escalation to human |
| 📦 **Order Processing** | Payment → Delivery pipeline | bKash/Nagad screenshot OCR, payment verification, Pathao/Steadfast courier booking |
| 📊 **Inventory** | Stock management | Low-stock alerts, auto-restock suggestions, product catalog sync |
| 🎨 **Creative** | AI content generation | Product image generation, Bangla/English captions, auto-posting to Facebook Page |
| 🧠 **Sales Intelligence** | Business analytics | Revenue trends, peak hours, top products, AI-driven recommendations |

---

## Subscription Plans (BDT Only)

| Plan | Price/mo | Agents | Orders/mo | Pages |
|---|---|---|---|---|
| 🟢 Starter | ৳২,৫০০ | Conversation only | 200 | 1 |
| 🔵 Professional | ৳৭,৫০০ | Conversation + Order + Inventory | 1,000 | 3 |
| 🟣 Premium | ৳২৫,০০০ | All 5 agents | Unlimited | 10 |
| ⚫ Enterprise | Custom | All 5 + White-label + API | Unlimited | Unlimited |

---

## Facebook App Setup

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add **Facebook Login** and **Messenger** products
3. Configure Messenger webhook URL: `https://yourdomain.com/api/webhooks/messenger`
4. Subscribe to page events: `messages`, `messaging_postbacks`
5. Set the verify token in `gateway/.env` → `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
6. Copy App ID / App Secret to `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`

---

## SSLCommerz Setup (Subscription Billing)

1. Sign up at [sslcommerz.com](https://www.sslcommerz.com)
2. Get Store ID and Store Password
3. Set `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` in `gateway/.env`
4. Set `SSLCOMMERZ_IS_SANDBOX=true` for testing
5. IPN (webhook) URL: `https://yourdomain.com/api/billing/webhook/sslcommerz/ipn`

---

## Courier API Setup

### Pathao
1. Register at [merchant.pathao.com](https://merchant.pathao.com)
2. Get Client ID, Client Secret, Username, Password
3. Set `PATHAO_*` vars in `gateway/.env`

### Steadfast
1. Register at [steadfast.com.bd](https://steadfast.com.bd)
2. Get API Key and Secret Key
3. Set `STEADFAST_*` vars in `gateway/.env`

---

## License

Proprietary — © 2024 XENI. All rights reserved.
