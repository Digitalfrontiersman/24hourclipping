#!/usr/bin/env bash
# ============================================================================
# Zero-touch Replit bootstrap: runs the FULL STACK (FastAPI + React) inside the
# Repl, against the Repl's OWN Postgres. Nothing here touches production.
#
#   Import the repo -> click Tools > PostgreSQL (one click) -> press Run.
#
# The React dev server proxies /api -> the local backend on 8001, so the browser
# sees a single origin (same as nginx in prod) and there's no CORS to configure.
# Only port 3000 is exposed publicly; the backend stays internal.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT=8001
VENV="$ROOT/.venv-backend"

say() { echo -e "[replit] $*"; }
die() { echo -e "\n[replit] ERROR: $*\n" >&2; exit 1; }

# ---------------------------------------------------------------- database ---
if [ -z "${DATABASE_URL:-}" ]; then
  die "No DATABASE_URL.

  Enable Postgres for this Repl (one-time):
    Tools  ->  PostgreSQL  ->  Create a database

  Replit injects DATABASE_URL automatically, then just press Run again."
fi

# Replit/Neon hand out  postgresql://...?sslmode=require&channel_binding=require
# SQLAlchemy needs the asyncpg driver, and asyncpg rejects libpq-style params
# like sslmode/channel_binding outright. Normalise both.
export DATABASE_URL="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

u = urlsplit(os.environ["DATABASE_URL"])
scheme = "postgresql+asyncpg"
q = [(k, v) for k, v in parse_qsl(u.query) if k not in ("sslmode", "channel_binding")]
# Managed Postgres (Neon, which backs Replit's DB) requires TLS; asyncpg spells
# it `ssl`, not `sslmode`.
if any(k == "sslmode" for k, _ in parse_qsl(urlsplit(os.environ["DATABASE_URL"]).query)):
    q.append(("ssl", "require"))
print(urlunsplit((scheme, u.netloc, u.path, urlencode(q), u.fragment)))
PY
)" || die "Could not parse DATABASE_URL"
say "Database: ${DATABASE_URL%%\?*}"

# ---------------------------------------------------------------- backend ----
if [ ! -d "$VENV" ]; then
  say "Creating Python venv (first run only)..."
  python3 -m venv "$VENV" || die "venv creation failed"
fi
if [ ! -f "$VENV/.deps-installed" ]; then
  say "Installing backend dependencies (first run only, ~2-3 min)..."
  "$VENV/bin/pip" install --upgrade pip -q
  "$VENV/bin/pip" install -q -r "$ROOT/backend/requirements-core.txt" \
    && touch "$VENV/.deps-installed" \
    || die "backend dependency install failed"
fi

mkdir -p "$ROOT/.media"

say "Starting FastAPI on :$BACKEND_PORT ..."
(
  cd "$ROOT/backend"
  exec "$VENV/bin/uvicorn" server:app --host 127.0.0.1 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!
# Don't leave a zombie backend behind when the Run button is stopped.
trap 'kill $BACKEND_PID 2>/dev/null' EXIT INT TERM

# Wait for the backend to actually be ready (uses the /api/health DB check).
say "Waiting for backend..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    say "Backend healthy (db reachable)."
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    die "Backend died on startup - scroll up for the traceback."
  fi
  sleep 2
  [ "$i" = 60 ] && die "Backend did not become healthy in 120s."
done

# --------------------------------------------------------------- frontend ----
cd "$ROOT/frontend"

# Replit images don't always expose yarn. Heal it rather than failing Run.
# NOTE: yarn is REQUIRED, not a preference - package.json uses `resolutions`,
# which npm ignores (it would silently install the wrong webpack-dev-server).
if ! command -v yarn >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g yarn >/dev/null 2>&1 || true
fi
if command -v yarn >/dev/null 2>&1; then YARN="yarn"; else YARN="npx --yes yarn"; fi

if [ ! -d node_modules ]; then
  say "Installing frontend dependencies (first run only, ~2-4 min)..."
  $YARN install || die "frontend dependency install failed"
fi

say "Starting React dev server on :${PORT:-3000} (proxying /api -> ${PROXY_API})"
exec $YARN start
