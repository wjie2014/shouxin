#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已生成 .env，请先填写 DM_SYSDBA_PWD、DM_PASSWORD 和 JWT_SECRET 后重新执行。" >&2
  exit 2
fi
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
