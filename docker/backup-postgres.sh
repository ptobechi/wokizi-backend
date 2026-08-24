#!/bin/bash
# Dumps the production Postgres database, keeps 7 days of local backups, and
# (if AWS_ACCESS_KEY_ID etc. are set) uploads to the same Cloudflare R2
# bucket the app already uses for file storage.
#
# A Docker named volume alone does NOT protect you from data loss — it
# protects the data from `docker compose down` / container removal / image
# rebuilds. It does NOT protect against the VPS itself being destroyed,
# disk failure, `docker compose down -v`, or `docker volume rm`. That's what
# this script is for: a second, off-host copy.
#
# Run via cron on the VPS, e.g. daily at 3am:
#   0 3 * * * /opt/wokizi/backend/docker/backup-postgres.sh >> /var/log/wokizi-backup.log 2>&1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/wokizi/backend/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/wokizi/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
CONTAINER="wokizi_postgres"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/wokizi_${TIMESTAMP}.dump"

echo "[$(date)] Starting backup -> $DUMP_FILE"

docker exec "$CONTAINER" pg_dump -U "${POSTGRES_USER:-wokizi}" -d "${POSTGRES_DB:-wokizi_db}" -Fc > "$DUMP_FILE"

echo "[$(date)] Local dump complete ($(du -h "$DUMP_FILE" | cut -f1))"

# ─── Off-host copy (R2) — skipped automatically if credentials aren't set ─────
if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "[$(date)] Uploading to R2..."
  AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    aws s3 cp "$DUMP_FILE" "s3://${AWS_S3_BUCKET}/db-backups/$(basename "$DUMP_FILE")" \
      --endpoint-url "$AWS_S3_ENDPOINT"
  echo "[$(date)] Upload complete"
else
  echo "[$(date)] WARNING: AWS_ACCESS_KEY_ID not set or aws CLI not installed — backup is LOCAL ONLY, not protected against VPS loss."
fi

# ─── Local retention ────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'wokizi_*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date)] Done."
