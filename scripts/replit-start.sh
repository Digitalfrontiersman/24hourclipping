#!/usr/bin/env bash
# Zero-touch Replit bootstrap for the FRONTEND only.
#
# Import the repo -> press Run. Nothing else. All config lives in the [env] block
# of /.replit (none of it is secret). The backend is NOT run here - the app talks
# to the live production API.
set -euo pipefail

cd "$(dirname "$0")/../frontend"

# Node 20 ships corepack, which provides the yarn shim. Replit images don't
# always expose yarn directly, so heal it rather than failing the Run button.
if ! command -v yarn >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g yarn >/dev/null 2>&1 || true
fi
if command -v yarn >/dev/null 2>&1; then
  YARN="yarn"
else
  YARN="npx --yes yarn"   # last resort: fetch yarn on demand
fi

# Install once; later Runs reuse node_modules and start immediately.
if [ ! -d node_modules ]; then
  echo "[replit] Installing frontend dependencies (first run only, ~2-4 min)..."
  $YARN install
fi

echo "[replit] API target: ${REACT_APP_BACKEND_URL:-same-origin}"
echo "[replit] Starting React dev server on port ${PORT:-3000}..."
exec $YARN start
