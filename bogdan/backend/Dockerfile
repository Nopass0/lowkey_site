# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go module files first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o bogdan-backend .

# ─── Stage 2: Run ─────────────────────────────────────────────────────────────
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS calls
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/bogdan-backend .

# Create uploads directory
RUN mkdir -p /app/uploads

# Non-root user
RUN addgroup -S bogdan && adduser -S bogdan -G bogdan
RUN chown -R bogdan:bogdan /app
USER bogdan

EXPOSE 8090

ENV PORT=8090
ENV UPLOAD_DIR=/app/uploads

CMD ["./bogdan-backend"]
