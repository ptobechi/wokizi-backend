#!/bin/sh
# Runs on every container start (not at build time) so DATABASE_URL is
# guaranteed to be live. `prisma migrate deploy` only applies pending
# migrations and is safe to run repeatedly — restarting this container
# never re-applies anything already recorded in _prisma_migrations.
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting: $*"
exec "$@"
