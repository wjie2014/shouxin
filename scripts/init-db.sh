#!/usr/bin/env bash
set -euo pipefail

: "${DM_SYSDBA_PWD:?DM_SYSDBA_PWD is required}"
: "${DM_USER:?DM_USER is required}"
: "${DM_PASSWORD:?DM_PASSWORD is required}"

if [[ ! "$DM_USER" =~ ^[A-Za-z][A-Za-z0-9_]{1,63}$ ]]; then
  echo "DM_USER 只能包含字母、数字和下划线，并以字母开头" >&2
  exit 2
fi
if [[ ! "$DM_PASSWORD" =~ ^[A-Za-z0-9_@.!+-]{8,128}$ ]]; then
  echo "DM_PASSWORD 至少8位，且只能包含字母、数字及 _@.!+-" >&2
  exit 2
fi

sql_file="$(mktemp)"
trap 'rm -f "$sql_file"' EXIT
cat >"$sql_file" <<SQL
WHENEVER SQLERROR CONTINUE;
CREATE USER ${DM_USER} IDENTIFIED BY "${DM_PASSWORD}";
ALTER USER ${DM_USER} IDENTIFIED BY "${DM_PASSWORD}";
GRANT RESOURCE, PUBLIC TO ${DM_USER};
COMMIT;
EXIT;
SQL

if ! disql "SYSDBA/${DM_SYSDBA_PWD}@dameng:5236" \
  "\`${sql_file}" >/tmp/shouxin-db-init.log 2>&1; then
  echo "连接达梦或执行初始化脚本失败" >&2
  tail -20 /tmp/shouxin-db-init.log >&2
  exit 1
fi

verify="$(printf 'SELECT COUNT(*) FROM DBA_USERS WHERE USERNAME=UPPER(\047%s\047);\nEXIT;\n' "$DM_USER" | disql "SYSDBA/${DM_SYSDBA_PWD}@dameng:5236" 2>/dev/null)"
if ! grep -Eq '(^|[[:space:]])1([[:space:]]|$)' <<<"$verify"; then
  echo "达梦业务用户初始化失败" >&2
  tail -20 /tmp/shouxin-db-init.log >&2
  exit 1
fi
echo "达梦业务用户已就绪"
