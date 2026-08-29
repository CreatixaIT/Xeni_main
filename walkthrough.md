# XENI AI Business OS — Final Walkthrough

## Summary
Built a complete, production-ready multi-tenant AI SaaS platform with **79 files** across all layers.

---

## Architecture

```
Browser → Nginx (:80) → Frontend (:3000) | Gateway (:8080) → RabbitMQ → Workers → MongoDB
                                           ↕ PostgreSQL  ↕ Redis
```

---

## Inventory (79 files)

### Infrastructure (18 files)
[docker-compose.yml](file:///c:/Users/Rizwan/Xeni-Agent/docker-compose.yml), PostgreSQL schema (8 tables, 10 enums), MongoDB init, RabbitMQ topology (3 exchanges, 6 queues, 6 DLQs), Nginx, Prometheus, Grafana (auto-provisioned dashboard with 9 panels), [.env.example](file:///c:/Users/Rizwan/Xeni-Agent/.env.example) × 4, [README.md](file:///c:/Users/Rizwan/Xeni-Agent/README.md), [wait-for-it.sh](file:///c:/Users/Rizwan/Xeni-Agent/scripts/wait-for-it.sh)

### Go API Gateway (20 files)
| Component | Files |
|-----------|-------|
| Config, Logger | [config.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/config/config.go), [logger.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/pkg/logger/logger.go) |
| Models (4) | user, billing, agent, json |
| Infra | [database.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/database/database.go), [redis.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/cache/redis.go), [rabbitmq.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/rabbitmq/rabbitmq.go), [hub.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/websocket/hub.go) |
| Services (5) | [auth](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/auth/handler.go), [billing](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/billing/handler.go), [agents](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/agents/handler.go), [user](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/user/handler.go), [admin](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/admin/handler.go) |
| Cross-cut | [middleware.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/middleware/middleware.go), [email/service.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/email/service.go), [validator.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/pkg/validator/validator.go), [jwt.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/pkg/jwt/jwt.go), [response.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/pkg/response/response.go) |
| Entry | [main.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/cmd/main.go), [router.go](file:///c:/Users/Rizwan/Xeni-Agent/gateway/internal/router/router.go), Dockerfile, go.mod |

### Next.js Frontend (26 files)
| Category | Files |
|----------|-------|
| Config | package.json, tsconfig.json, tailwind.config.js, next.config.js, postcss.config.js |
| i18n | routing.ts, request.ts, middleware.ts, en.json, bn.json |
| Core | globals.css, root layout, locale layout, not-found.tsx |
| Store/Lib | auth.ts (Zustand), api.ts (Axios), useWebSocket.ts |
| Pages (9) | Landing, Login, Register, Dashboard (bento grid), Billing (dual currency), Settings (tabbed), Agent `[slug]`, Admin, OTP Verify, Forgot Password, Reset Password |
| Components | Navbar, ProtectedRoute, LoadingSpinner |
| Build | Dockerfile, .dockerignore, .env |

### Python AI Workers (8 files)
| File | Purpose |
|------|---------|
| [base_worker.py](file:///c:/Users/Rizwan/Xeni-Agent/workers/app/base_worker.py) | RabbitMQ consumer with retry/DLQ logic |
| [agents.py](file:///c:/Users/Rizwan/Xeni-Agent/workers/app/agents.py) | 6 agents: SEO, Lead Gen, Social Media, Content, Email, Analytics |
| [main.py](file:///c:/Users/Rizwan/Xeni-Agent/workers/app/main.py) | FastAPI + background RabbitMQ consumer |
| [metrics.py](file:///c:/Users/Rizwan/Xeni-Agent/workers/app/metrics.py) | Prometheus counters, histograms, gauges |
| requirements.txt, pyproject.toml, Dockerfile, .dockerignore, .env | Build & config |

### DevOps (4 files)
- [CI/CD Pipeline](file:///c:/Users/Rizwan/Xeni-Agent/.github/workflows/ci.yml) — Go lint/test, Next.js lint/build, Python lint, Docker build/push to GHCR
- [.gitignore](file:///c:/Users/Rizwan/Xeni-Agent/.gitignore)
- Root [.env](file:///c:/Users/Rizwan/Xeni-Agent/.env)

---

## Key Capabilities
- **Auth**: Email/password, Google OAuth, TOTP 2FA, OTP email verification, JWT with Redis blocklist
- **Billing**: Dual gateway (SSLCommerz for BD, Stripe for international), server-enforced routing, webhook handlers
- **AI Agents**: 6 specialized agents with subscription-gated access, RabbitMQ task queuing, retry/DLQ
- **Real-time**: WebSocket for task status updates and subscription changes
- **i18n**: English + বাংলা with next-intl
- **Monitoring**: Grafana dashboard (9 panels) + Prometheus metrics
- **Email**: Styled transactional emails via Resend API (OTP, welcome, subscription)

## How to Run
```bash
docker compose up -d                      # Infrastructure only
docker compose --profile app up -d        # All services
```
