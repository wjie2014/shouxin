@echo off
setlocal
cd /d "%~dp0\.."
if not exist .env (
  copy .env.example .env >nul
  echo 已生成 .env，请填写数据库密码和 JWT_SECRET 后重新执行。
  exit /b 2
)
docker compose --env-file .env -f docker-compose.prod.yml config --quiet || exit /b 1
docker compose --env-file .env -f docker-compose.prod.yml up -d --build || exit /b 1
docker compose --env-file .env -f docker-compose.prod.yml ps
