#!/usr/bin/env sh
# Daily Postgres backup for cad-portal Docker Postgres.
# Runs inside postgres-backup service; expects PGHOST=postgres and POSTGRES_* from env_file.

set -eu

: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

PGHOST="${PGHOST:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_DIR="/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/${POSTGRES_DB}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="$POSTGRES_PASSWORD"

while true; do
  echo "[pg-backup] Dumping ${POSTGRES_DB} at $(date -Iseconds)..."
  pg_dump -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILE"
  echo "[pg-backup] Written $FILE"

  find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

  sleep 86400
done
