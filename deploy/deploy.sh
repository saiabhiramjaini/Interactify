#!/usr/bin/env bash
# Deploys the Interactify server on the phone (Termux). Run by GitHub Actions over SSH:
#
#   ssh phone 'bash -s' -- <commit-sha> < deploy/deploy.sh
#
# The script is streamed from the commit being deployed, so it never depends on an
# older copy on the phone. CI builds the server; the compiled dist/ is uploaded to
# $ARTIFACT beforehand, so the phone only installs production dependencies.
set -euo pipefail

SHA="${1:?usage: deploy.sh <commit-sha>}"
REPO_DIR="${REPO_DIR:-$HOME/Interactify}"
BRANCH="${BRANCH:-main}"
APP="${PM2_APP:-interactify}"
ARTIFACT="${ARTIFACT:-$HOME/interactify-dist.tgz}"
SERVER_DIR="$REPO_DIR/server"
HEALTH_TIMEOUT=30

log() { echo "==> $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

for cmd in git node npm pm2 redis-cli redis-server tar; do
  command -v "$cmd" >/dev/null || fail "$cmd is not installed (see deploy/README.md)"
done
[ -f "$ARTIFACT" ] || fail "build artifact $ARTIFACT not found"

log "Updating $REPO_DIR to $SHA"
cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
# Fast-forward only: never discard commits or local changes on the phone
git merge --ff-only --quiet "$SHA" || fail "cannot fast-forward $BRANCH to $SHA; check for local changes on the phone"

# One-time migration: the server used to live in server-without-kafka/
if [ ! -f "$SERVER_DIR/.env" ] && [ -f "$REPO_DIR/server-without-kafka/.env" ]; then
  log "Copying .env from server-without-kafka/ to server/"
  cp "$REPO_DIR/server-without-kafka/.env" "$SERVER_DIR/.env"
fi
[ -f "$SERVER_DIR/.env" ] || fail "$SERVER_DIR/.env is missing"

# Reads KEY from server/.env, falling back to a default
env_value() {
  local value
  value="$(grep -E "^$1=" "$SERVER_DIR/.env" | tail -n 1 | cut -d= -f2- | tr -d "\"' " || true)"
  echo "${value:-$2}"
}

PORT="$(env_value PORT 8080)"
REDIS_HOST="$(env_value REDIS_HOST localhost)"
REDIS_PORT="$(env_value REDIS_PORT 6379)"

if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
  case "$REDIS_HOST" in
    localhost|127.0.0.1)
      log "Starting Redis on port $REDIS_PORT"
      redis-server --port "$REDIS_PORT" --daemonize yes
      sleep 1
      redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 || fail "Redis did not start"
      ;;
    *)
      fail "Redis at $REDIS_HOST:$REDIS_PORT is not reachable"
      ;;
  esac
fi

log "Installing production dependencies"
cd "$SERVER_DIR"
npm ci --omit=dev --no-audit --no-fund

log "Unpacking build"
STAGING="$(mktemp -d)"
tar xzf "$ARTIFACT" -C "$STAGING"
[ -f "$STAGING/dist/index.js" ] || fail "artifact does not contain dist/index.js"
rm -rf dist.prev
[ -d dist ] && mv dist dist.prev
mv "$STAGING/dist" dist
rm -rf "$STAGING" "$ARTIFACT"

# Stop servers still running from the old server-without-kafka/ folder; they hold the same port.
# Matches on the script too: other processes (e.g. cloudflare-tunnel) may share that folder.
pm2 jlist | node -e '
  let data = "";
  process.stdin.on("data", (chunk) => (data += chunk)).on("end", () => {
    for (const proc of JSON.parse(data || "[]")) {
      const env = proc.pm2_env || {};
      const command = [env.pm_exec_path, ...(env.args || [])].join(" ");
      if ((env.pm_cwd || "").endsWith("/server-without-kafka") && command.includes("dist/index.js")) {
        console.log(proc.name);
      }
    }
  });
' | while read -r old; do
  log "Removing old PM2 process $old"
  pm2 delete "$old" >/dev/null
done

start_app() {
  # delete + start (not restart) so the script path and working directory are always current
  pm2 delete "$APP" >/dev/null 2>&1 || true
  pm2 start "$SERVER_DIR/dist/index.js" --name "$APP" --cwd "$SERVER_DIR" >/dev/null
}

healthy() {
  # shellcheck disable=SC2016 # JavaScript template literal, not a shell expansion
  node -e '
    fetch(`http://127.0.0.1:${process.argv[1]}/health`)
      .then((res) => process.exit(res.ok ? 0 : 1))
      .catch(() => process.exit(1));
  ' "$PORT"
}

wait_for_health() {
  for _ in $(seq "$HEALTH_TIMEOUT"); do
    healthy && return 0
    sleep 1
  done
  return 1
}

log "Restarting $APP"
start_app

if wait_for_health; then
  pm2 save >/dev/null
  rm -rf dist.prev
  log "Deployed $SHA; http://127.0.0.1:$PORT/health is healthy"
  exit 0
fi

echo "Health check failed. Recent logs:" >&2
pm2 logs "$APP" --lines 40 --nostream >&2 || true

if [ -d dist.prev ]; then
  log "Rolling back to the previous build"
  rm -rf dist
  mv dist.prev dist
  start_app
  wait_for_health && pm2 save >/dev/null && log "Previous build restored"
fi

fail "deployment of $SHA failed"
