#!/bin/bash
# Redeploy the backend on the VPS after pushing new commits.
#
# Run ON THE VPS:
#   /opt/wokizi/backend/docker/deploy.sh
#
# Only rebuilds/recreates the `app` container — postgres is left untouched,
# so this never risks the database, and startup stays fast since nothing
# re-pulls or rebuilds the (unchanged) postgres image.
#
# Migrations run automatically as part of the container's own entrypoint
# (docker/entrypoint.sh -> prisma migrate deploy) every time it starts, so
# there's no separate migration step here.
#
# --env-file is passed explicitly on every compose call rather than relying
# on the .env -> .env.production symlink — the single most common failure
# mode we hit setting this up was that flag getting silently dropped.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
HEALTH_URL="http://localhost:3000/api/v1/health"

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] ERROR: $ENV_FILE not found in $REPO_DIR. Aborting." >&2
  exit 1
fi

echo "[deploy] $(date '+%Y-%m-%d %H:%M:%S') — pulling latest code..."
git pull

echo "[deploy] Building updated image..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build app

echo "[deploy] Starting new container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app

echo "[deploy] Waiting for health check..."
for i in $(seq 1 15); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "[deploy] Healthy. Deploy complete."
    docker image prune -f > /dev/null 2>&1 || true   # drop dangling images left by the rebuild
    exit 0
  fi
  sleep 2
done

echo "[deploy] Health check did not pass within 30s." >&2
echo "[deploy] Check logs: docker compose -f $COMPOSE_FILE logs --tail=100 app" >&2
exit 1
