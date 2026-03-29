#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply any SQL migration files that haven't been tracked yet.
# Migrations must be idempotent (use IF NOT EXISTS / ADD VALUE IF NOT EXISTS).
MIGRATIONS_DIR="lib/db/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
  for sql_file in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$sql_file" ] || continue
    echo "Applying migration: $sql_file"
    psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$sql_file"
  done
fi

pnpm --filter db push
