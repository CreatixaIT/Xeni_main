# ============================================================
# XENI — Go API Gateway Dockerfile
# ============================================================

# ── Build Stage ──
FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /build
COPY go.mod ./
COPY go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o gateway ./cmd/main.go

# ── Development Stage ──
FROM golang:1.24-alpine AS development
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod ./
COPY go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN go mod tidy
EXPOSE 8080
CMD ["go", "run", "./cmd/main.go"]

# ── Production Stage ──
FROM alpine:3.19 AS production
LABEL org.opencontainers.image.source=https://github.com/XenDevHub/xeni
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --chown=nobody:nobody --from=builder /build/gateway .
EXPOSE 8080
USER nobody:nobody
CMD ["/app/gateway"]
