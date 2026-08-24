#!/bin/bash
# Restores a Postgres dump produced by backup-postgres.sh.
#
# Usage: ./restore-postgres.sh /path/to/wokizi_20260101_030000.dump
#
# ⚠ This drops and recreates the target database. Confirms before running.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/wokizi/backend/.env.production}"
CONTAINER="wokizi_postgres"
DUMP_FILE="${1:?Usage: $0 <path-to-dump-file>}"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

DB_USER="${POSTGRES_USER:-wokizi}"
DB_NAME="${POSTGRES_DB:-wokizi_db}"

echo "About to restore '$DUMP_FILE' into database '$DB_NAME'."
echo "This will DROP all current data in that database."
read -r -p "Type the database name to confirm: " CONFIRM
if [ "$CONFIRM" != "$DB_NAME" ]; then
  echo "Confirmation did not match. Aborting."
  exit 1
fi

docker cp "$DUMP_FILE" "$CONTAINER":/tmp/restore.dump

docker exec "$CONTAINER" dropdb -U "$DB_USER" --if-exists "$DB_NAME"
docker exec "$CONTAINER" createdb -U "$DB_USER" "$DB_NAME"
docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" /tmp/restore.dump
docker exec "$CONTAINER" rm /tmp/restore.dump

echo "Restore complete. Verify with: docker exec -it $CONTAINER psql -U $DB_USER -d $DB_NAME -c '\\dt'"
