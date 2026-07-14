#!/usr/bin/env bash
#
# One-time setup of a self-hosted GitHub Actions runner on the production VPS.
# The runner polls GitHub over outbound HTTPS and runs .github/workflows/deploy.yml
# locally on every push to main, so we never expose inbound SSH/ports.
#
# USAGE (run ON the box, as the `ubuntu` user):
#   1. Get a runner registration token:
#        GitHub repo -> Settings -> Actions -> Runners -> "New self-hosted runner"
#        -> copy the value after `--token` (it expires in ~1 hour).
#   2. Run:  bash setup-github-runner.sh <REGISTRATION_TOKEN>
#
set -euo pipefail

REPO_URL="https://github.com/Digitalfrontiersman/24hourclipping"
LABELS="clip-prod"
RUNNER_NAME="clip-prod-vps"
RUNNER_DIR="$HOME/actions-runner"

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: pass the runner registration token as the first argument." >&2
  echo "  Get it at: ${REPO_URL}/settings/actions/runners/new" >&2
  exit 1
fi

echo ">> Installing prerequisites (git, rsync, curl, tar)..."
sudo apt-get update -y
sudo apt-get install -y git rsync curl tar jq

echo ">> Fetching the latest runner version..."
VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')"
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then VERSION="2.328.0"; fi
echo "   runner v${VERSION}"

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f ./config.sh ]; then
  TARBALL="actions-runner-linux-x64-${VERSION}.tar.gz"
  curl -fsSL -o "$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${VERSION}/${TARBALL}"
  tar xzf "$TARBALL"
  rm -f "$TARBALL"
fi

echo ">> Registering the runner with ${REPO_URL}..."
./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --labels "$LABELS" \
  --name "$RUNNER_NAME" \
  --work "_work" \
  --unattended \
  --replace

echo ">> Installing + starting the runner as a service..."
sudo ./svc.sh install "$(whoami)"
sudo ./svc.sh start

echo ""
echo "Done. Runner '${RUNNER_NAME}' (labels: ${LABELS}) is live and listening."
echo "It will now deploy automatically on every push to main."
echo "Check status: sudo ${RUNNER_DIR}/svc.sh status"
