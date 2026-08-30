# 知识问答对管理系统

面向正式交付的知识问答全生命周期管理平台，覆盖问答对维护、三级知识目录、动态字段方案、可配置多人审批、版本更新与退役、Excel 导入导出、统计分析以及用户/角色/日志/参数管理。

## 技术栈

- 前端：React 19、TypeScript、Vite、ECharts
- 后端：Java 17、Spring Boot 3.5、Spring Security、JWT、JDBC
- 数据库：达梦 DM8
- 部署：Docker Compose、Nginx，前后端均使用多阶段镜像且以非源码制品交付

## 本地开发

复制 `.env.example` 为 `.env` 并配置数据库与 JWT 密钥。达梦数据库就绪后分别启动：

```bash
DM_PASSWORD='你的业务用户密码' JWT_SECRET='至少32位随机密钥' mvn -f backend/pom.xml spring-boot:run
pnpm --dir apps/web dev --host 0.0.0.0
```

访问 `http://localhost:5173/`，初始化管理员账号为 `admin / admin123`。首次登录后应立即修改密码。

## 生产部署

```bash
cp .env.example .env
# 修改 .env 中所有密码、密钥及平台架构配置
bash scripts/install.sh
```

默认入口为 `http://服务器地址:8080/`。数据库与后端 API 默认仅绑定本机回环地址，外部只开放 Web 入口。详细步骤、备份恢复、升级和安全建议见 [DEPLOYMENT.md](DEPLOYMENT.md)，需求覆盖与验收证据见 [ACCEPTANCE.md](ACCEPTANCE.md) 和 [docs/REQUIREMENT_TRACEABILITY.md](docs/REQUIREMENT_TRACEABILITY.md)。

## 质量验证

```bash
pnpm --dir apps/web build
mvn -f backend/pom.xml test
bash scripts/smoke.sh
```
