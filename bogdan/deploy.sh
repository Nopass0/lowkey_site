#!/usr/bin/env bash
# deploy.sh — production deploy for bogdan.lowkey.su personal workspace
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BOGDAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="bogdan.lowkey.su"
BACKEND_URL="http://127.0.0.1:8090/health"
FRONTEND_URL="http://127.0.0.1:3210/"
NGINX_AVAILABLE="/etc/nginx/sites-available/bogdan.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/bogdan.conf"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
WEBROOT="/var/www/certbot"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[bogdan-deploy] $*"; }
warn() { echo "[bogdan-deploy] WARNING: $*" >&2; }
die()  { echo "[bogdan-deploy] ERROR: $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "This script must be run as root (or with sudo)."
  fi
}

# ---------------------------------------------------------------------------
# 1. Validate working directory and env file
# ---------------------------------------------------------------------------
validate_env() {
  log "Validating environment..."

  cd "${BOGDAN_DIR}"

  if [[ ! -f ".env.bogdan" ]]; then
    die ".env.bogdan not found in ${BOGDAN_DIR}. Copy .env.example to .env.bogdan and fill in the values."
  fi

  # Source the env file to validate required keys
  # shellcheck disable=SC1091
  set -a
  source .env.bogdan
  set +a

  local missing=()

  [[ -z "${VOIDDB_URL:-}"               ]] && missing+=("VOIDDB_URL")
  [[ -z "${VOIDDB_TOKEN:-}"             ]] && missing+=("VOIDDB_TOKEN")
  [[ -z "${JWT_SECRET:-}"               ]] && missing+=("JWT_SECRET")
  [[ -z "${TELEGRAM_BOT_TOKEN:-}"       ]] && missing+=("TELEGRAM_BOT_TOKEN")
  [[ -z "${BOGDAN_TELEGRAM_USER_IDS:-}" ]] && missing+=("BOGDAN_TELEGRAM_USER_IDS")

  if [[ ${#missing[@]} -gt 0 ]]; then
    die "Missing required variables in .env.bogdan: ${missing[*]}"
  fi

  if [[ "${#JWT_SECRET}" -lt 32 ]]; then
    die "JWT_SECRET must be at least 32 characters."
  fi

  log "Environment OK."
}

# ---------------------------------------------------------------------------
# 2. Ensure nginx + certbot are installed
# ---------------------------------------------------------------------------
ensure_packages() {
  log "Checking system packages..."

  if ! command -v nginx &>/dev/null; then
    log "Installing nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
  fi

  if ! command -v certbot &>/dev/null; then
    log "Installing certbot..."
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
  fi

  if ! command -v docker &>/dev/null; then
    die "Docker is not installed. Install Docker Engine before running this script."
  fi

  # Ensure webroot directory exists for certbot challenges
  mkdir -p "${WEBROOT}"

  log "Packages OK."
}

# ---------------------------------------------------------------------------
# 3. Install nginx config (HTTP-only first so certbot challenge works)
# ---------------------------------------------------------------------------
install_nginx_http() {
  log "Installing HTTP-only nginx config for ACME challenge..."

  # Write a minimal HTTP config that serves the certbot challenge and
  # redirects everything else. We swap it for the full HTTPS config after
  # certbot runs.
  cat > "${NGINX_AVAILABLE}" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name bogdan.lowkey.su;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX

  ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  nginx -t
  systemctl reload nginx
  log "HTTP nginx config active."
}

# ---------------------------------------------------------------------------
# 4. Obtain or verify TLS certificate
# ---------------------------------------------------------------------------
ensure_certificate() {
  if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
    log "TLS certificate already exists for ${DOMAIN}. Skipping certbot."
    return
  fi

  if [[ -z "${LETSENCRYPT_EMAIL}" ]]; then
    die "LETSENCRYPT_EMAIL env var is required to obtain a certificate. Example: LETSENCRYPT_EMAIL=admin@lowkey.su ./deploy.sh"
  fi

  log "Obtaining TLS certificate for ${DOMAIN}..."

  certbot certonly \
    --webroot \
    -w "${WEBROOT}" \
    -d "${DOMAIN}" \
    --non-interactive \
    --agree-tos \
    -m "${LETSENCRYPT_EMAIL}"

  log "Certificate obtained."
}

# ---------------------------------------------------------------------------
# 5. Install full HTTPS nginx config
# ---------------------------------------------------------------------------
install_nginx_https() {
  log "Installing full HTTPS nginx config..."

  cp "${BOGDAN_DIR}/nginx.conf" "${NGINX_AVAILABLE}"

  # Ensure the connection upgrade map exists (required by nginx.conf)
  local map_file="/etc/nginx/conf.d/ws_upgrade_map.conf"
  if [[ ! -f "${map_file}" ]]; then
    cat > "${map_file}" <<'MAP'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
MAP
    log "Created WebSocket upgrade map at ${map_file}."
  fi

  ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  nginx -t
  systemctl reload nginx
  log "HTTPS nginx config active."
}

# ---------------------------------------------------------------------------
# 6. Build and start Docker services
# ---------------------------------------------------------------------------
deploy_containers() {
  log "Building and starting Docker services..."

  cd "${BOGDAN_DIR}"

  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1

  docker compose \
    -f docker-compose.yml \
    --env-file .env.bogdan \
    -p bogdan \
    up -d --build --remove-orphans \
    backend frontend

  log "Containers started."
}

# ---------------------------------------------------------------------------
# 7. Wait for backend health
# ---------------------------------------------------------------------------
wait_for_backend() {
  log "Waiting for backend to become healthy (${BACKEND_URL})..."

  local attempt
  for attempt in {1..30}; do
    if curl -fsS "${BACKEND_URL}" >/dev/null 2>&1; then
      log "Backend is healthy (attempt ${attempt})."
      return
    fi
    sleep 5
  done

  echo "" >&2
  die "Backend did not become healthy after 150s. Check logs: docker compose -p bogdan logs --tail=200 backend"
}

# ---------------------------------------------------------------------------
# 8. Wait for frontend health
# ---------------------------------------------------------------------------
wait_for_frontend() {
  log "Waiting for frontend to become healthy (${FRONTEND_URL})..."

  local attempt
  for attempt in {1..48}; do
    if curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; then
      log "Frontend is healthy (attempt ${attempt})."
      return
    fi
    sleep 5
  done

  echo "" >&2
  die "Frontend did not become healthy after 240s. Check logs: docker compose -p bogdan logs --tail=200 frontend"
}

# ---------------------------------------------------------------------------
# 9. Final reload to pick up any running-container state
# ---------------------------------------------------------------------------
final_nginx_reload() {
  nginx -t && systemctl reload nginx
  log "Nginx reloaded."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  require_root
  validate_env
  ensure_packages
  install_nginx_http
  ensure_certificate
  install_nginx_https
  deploy_containers
  wait_for_backend
  wait_for_frontend
  final_nginx_reload

  echo ""
  echo "================================================================"
  echo "  bogdan workspace deployed successfully!"
  echo "  URL: https://${DOMAIN}"
  echo "================================================================"
}

main "$@"
