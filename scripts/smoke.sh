#!/usr/bin/env bash
set -euo pipefail
api="${API_URL:-http://localhost:3000}"
curl -fsS "$api/health" >/dev/null
token=$(curl -fsS -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' "$api/api/auth/login" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')
for endpoint in /api/auth/me /api/domains/tree /api/statistics/dashboard /api/qa-pairs /api/reviews/tasks /api/admin/review-flows /api/field-schemes /api/admin/operation-logs /api/admin/config; do
  curl -fsS -H "Authorization: Bearer $token" "$api$endpoint" >/dev/null
done
curl -fsS -H "Authorization: Bearer $token" -o /tmp/qa-first-stage.xlsx "$api/api/export/first-stage"
curl -fsS -H "Authorization: Bearer $token" -o /tmp/qa-second-stage.xlsx "$api/api/export/second-stage"
echo "smoke tests passed"
