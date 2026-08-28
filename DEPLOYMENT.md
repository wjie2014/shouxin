# 生产部署

## 构建

```bash
mvn -q -f backend/pom.xml clean package -DskipTests
pnpm --dir apps/web build
```

## Docker Compose

复制 `.env.example` 为部署环境变量文件，至少设置 `DM_PASSWORD` 与长度不少于 32 的 `JWT_SECRET`，然后执行：

```bash
docker compose -f docker-compose.prod.yml up -d --build
curl http://localhost:3000/health
```

前端访问 `http://localhost:8080`。首次登录后应立即修改管理员密码。DM 数据与日志使用命名卷持久化；上线前配置定时备份、TLS 反向代理、日志采集和 DM 正式授权文件。
