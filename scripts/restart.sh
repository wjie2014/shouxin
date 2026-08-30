#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file .env -f docker-compose.prod.yml restart api web
docker compose --env-file .env -f docker-compose.prod.yml ps
