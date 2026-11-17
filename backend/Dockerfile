# Multi-stage Dockerfile for Eneba Marketplace Go REST API
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Download dependencies first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build static Linux binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/api ./cmd/api

FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/api /app/api
COPY --from=builder /src/migrations /app/migrations

ENV PORT=8080
ENV ENV=production

EXPOSE 8080

CMD ["/app/api"]
