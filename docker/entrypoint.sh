#!/bin/sh
set -e

# Apply pending migrations before starting — but only for the process that opts in
# (the API), so the worker container doesn't race it. Set RUN_MIGRATIONS=true on
# exactly one service.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Applying database migrations…"
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting: $*"
exec "$@"
