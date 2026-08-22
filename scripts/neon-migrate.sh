#!/usr/bin/env bash
# Copy all data from Neon into the local Docker Postgres container (cad-portal).
#
# Usage (from repo root):
#   ./scripts/neon-migrate.sh          # interactive confirm
#   ./scripts/neon-migrate.sh -y       # skip confirm
#
# Requires:
#   - .env with POSTGRES_* and NEON_DATABASE_URL
#   - docker compose postgres service running
set -euo pipefail

YES=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=true ;;
  esac
done

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo ".env not found — copy .env.example to .env first" >&2
  exit 1
fi

set -a
source .env
set +a

: "${POSTGRES_USER:?POSTGRES_USER not set in .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set in .env}"
: "${POSTGRES_DB:?POSTGRES_DB not set in .env}"

NEON_URL="${NEON_DATABASE_URL:-}"
if [ -z "$NEON_URL" ]; then
  echo "NEON_DATABASE_URL not set in .env" >&2
  echo "Add your Neon connection string; DATABASE_URL should point at Docker Postgres." >&2
  exit 1
fi

if ! docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  echo "Starting postgres..."
  docker compose up postgres -d
  echo "Waiting for postgres to be healthy..."
  sleep 5
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DUMP_FILE="$WORKDIR/neon_dump.custom"

count_core_tables() {
  local url_or_empty="$1"
  local run_psql
  if [ -n "$url_or_empty" ]; then
    run_psql() {
      docker run --rm postgres:17-alpine psql "$url_or_empty" -t -A -c "$1" 2>/dev/null
    }
  else
    run_psql() {
      docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$1" 2>/dev/null
    }
  fi

  local tasks users customers submissions
  tasks="$(run_psql "SELECT count(*) FROM tasks" || echo "?")"
  users="$(run_psql "SELECT count(*) FROM users" || echo "?")"
  customers="$(run_psql "SELECT count(*) FROM customer" || echo "?")"
  submissions="$(run_psql "SELECT count(*) FROM submissions" || echo "?")"
  echo "${tasks} tasks, ${users} users, ${customers} customers, ${submissions} submissions"
}

echo "==> Dumping Neon database..."
docker run --rm -v "$WORKDIR:/dump" postgres:17-alpine \
  pg_dump --no-owner --no-acl -F c -f /dump/neon_dump.custom "$NEON_URL"

echo "==> Row counts in Neon (reference)..."
SOURCE_COUNTS="$(count_core_tables "$NEON_URL" || echo "n/a")"
echo "    Neon:   $SOURCE_COUNTS"

echo "==> Copying dump into postgres container..."
docker compose cp "$DUMP_FILE" postgres:/tmp/neon_dump.custom

if [ "$YES" != true ]; then
  read -r -p "Overwrite local Docker Postgres (${POSTGRES_DB}) with Neon data? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    docker compose exec postgres rm -f /tmp/neon_dump.custom
    exit 1
  fi
fi

echo "==> Restoring into Docker Postgres..."
docker compose exec postgres pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-acl --clean --if-exists \
  /tmp/neon_dump.custom || true

docker compose exec postgres rm -f /tmp/neon_dump.custom

echo "==> Row counts in Docker Postgres..."
LOCAL_COUNTS="$(count_core_tables "")"
echo "    Local:  $LOCAL_COUNTS"

echo "==> Tables in Docker Postgres..."
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt" 2>/dev/null || true

echo
echo "Done. Use this DATABASE_URL for local dev:"
echo "  postgresql://${POSTGRES_USER}:***@localhost:5434/${POSTGRES_DB}"
echo "Docker app uses hostname postgres:5432 inside the compose network."
echo "Restart the app: docker compose up -d cad-portal  (or npm run dev locally)"
