#!/usr/bin/env bash
set -euo pipefail
api="${API_URL:-http://localhost:3000}"
curl -fsS "$api/health" >/dev/null
token=$(curl -fsS -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' "$api/api/auth/login" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')
for endpoint in /api/auth/me /api/domains/tree /api/statistics/dashboard /api/qa-pairs '/api/reviews/pending?page=1&pageSize=10' /api/admin/review-flows /api/field-schemes /api/admin/operation-logs /api/admin/config; do
  curl -fsS -H "Authorization: Bearer $token" "$api$endpoint" >/dev/null
done
curl -fsS -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -d '{"mode":"trend","granularity":"day","timeField":"createdAt","page":1,"pageSize":10,"filters":{}}' \
  "$api/api/analysis/query" | python3 -c 'import json,sys; data=json.load(sys.stdin); assert "summary" in data and isinstance(data.get("items"), list)'
curl -fsS -H "Authorization: Bearer $token" -o /tmp/qa-first-stage.xlsx "$api/api/export/first-stage"
curl -fsS -H "Authorization: Bearer $token" -o /tmp/qa-second-stage.xlsx "$api/api/export/second-stage"
python3 - <<'PY'
from pathlib import Path
for path in (Path('/tmp/qa-first-stage.xlsx'), Path('/tmp/qa-second-stage.xlsx')):
    assert path.read_bytes()[:2] == b'PK', f'{path} is not a valid OOXML workbook'
PY
echo "smoke tests passed"
