#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT=8080
FRONTEND_PORT=5173
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${BLUE}[run]${RESET} $*"; }
ok()   { echo -e "${GREEN}[run]${RESET} $*"; }
warn() { echo -e "${YELLOW}[run]${RESET} $*"; }
die()  { echo -e "${RED}[run]${RESET} $*" >&2; exit 1; }

# ── dependency checks ─────────────────────────────────────────────────────────
command -v go   &>/dev/null || die "go not found. Install Go from https://go.dev/dl/"
command -v npm  &>/dev/null || die "npm not found. Install Node.js from https://nodejs.org/"

# ── port conflict check ───────────────────────────────────────────────────────
for port in $BACKEND_PORT $FRONTEND_PORT; do
  if lsof -i ":$port" -sTCP:LISTEN &>/dev/null; then
    die "Port $port is already in use. Stop the conflicting process and retry."
  fi
done

# ── install frontend deps if node_modules is missing ─────────────────────────
if [[ ! -d frontend/node_modules ]]; then
  log "Installing frontend dependencies..."
  npm install --prefix frontend --silent
fi

# ── ensure data directory exists ─────────────────────────────────────────────
mkdir -p data

# ── cleanup on exit ───────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  log "Shutting down..."
  [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID"  2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  ok "Stopped."
}
trap cleanup EXIT INT TERM

# ── start backend ─────────────────────────────────────────────────────────────
log "Building and starting backend..."
go run ./cmd/server/ &
BACKEND_PID=$!

# Wait for the backend to accept connections (max 10 s)
for i in $(seq 1 20); do
  if curl -s "http://localhost:$BACKEND_PORT/api/readings" &>/dev/null; then
    break
  fi
  sleep 0.5
done

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  die "Backend failed to start."
fi

# ── start frontend ────────────────────────────────────────────────────────────
log "Starting frontend..."
npm run dev --prefix frontend --silent &
FRONTEND_PID=$!

sleep 2

# ── ready ─────────────────────────────────────────────────────────────────────
echo ""
ok "Everything is running:"
echo -e "  ${GREEN}Frontend${RESET}  →  http://localhost:$FRONTEND_PORT"
echo -e "  ${GREEN}Backend${RESET}   →  http://localhost:$BACKEND_PORT"
echo -e "  ${GREEN}WebSocket${RESET} →  ws://localhost:$BACKEND_PORT/ws"
echo ""
echo -e "  API endpoints:"
echo -e "    GET  /api/readings"
echo -e "    GET  /api/anomalies"
echo -e "    POST /api/reports"
echo -e "    GET  /api/forecast?building=library"
echo ""
warn "Press Ctrl+C to stop."
echo ""

# Keep running until a process dies or user hits Ctrl+C
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done