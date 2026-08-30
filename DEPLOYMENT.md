# 知识问答对管理系统部署与运维说明

## 1. 交付技术栈

- 前端：React 19、TypeScript、Vite、ECharts 6，生产环境由 Nginx 提供静态资源和同源 API 反向代理。
- 后端：Java 17、Spring Boot 3.5、Spring Security、JWT、Spring JDBC、Apache POI。
- 数据库：达梦 DM8；应用使用独立业务用户，禁止使用 SYSDBA 连接。
- 部署：Docker Engine 26+、Docker Compose v2；支持客户内网私有化部署。
- 数据持久化：达梦数据、达梦日志、业务附件分别使用独立 Docker volume。

浏览器只访问 Web 服务（默认 `http://服务器IP:8080`），前端通过同源 `/api` 调用后端，不会错误请求终端用户电脑的 localhost。

## 2. 服务器准备

建议最低配置为 4 核 CPU、8 GB 内存、100 GB 可用磁盘。正式环境须使用客户已授权的达梦官方镜像或安装包，并将 `.env` 中 `DM_IMAGE`、`DM_PLATFORM` 调整为实际镜像和 CPU 架构。

将交付包上传到服务器后执行：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

- `DM_SYSDBA_PWD`：达梦管理员强密码；
- `DM_PASSWORD`：应用业务用户强密码；
- `JWT_SECRET`：不少于 32 位的随机字符串；
- `DM_IMAGE`、`DM_PLATFORM`：客户正式达梦镜像和服务器架构。

密码不要提交到 Git，也不要写进镜像。业务数据库密码允许字符范围为字母、数字和 `_@.!+-`，长度 8～128 位。

## 3. 一键安装

Linux/macOS：

```bash
./scripts/install.sh
```

Windows：

```bat
scripts\install.bat
```

安装程序会完成配置校验、镜像构建、达梦健康等待、业务用户创建/密码同步、后端迁移和服务启动。数据库结构与预置数据由 `V001`～最新版本迁移脚本幂等执行。

## 4. 启停与检查

```bash
./scripts/start.sh
./scripts/stop.sh
./scripts/restart.sh
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f api web dameng
```

健康检查：

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/
```

默认登录账号为 `admin / admin123`。首次登录必须修改密码；各角色验收账号的初始密码相同，详见验收文档。生产交付前应全部重置。

## 5. 构建验证

不使用 Docker 时可独立验证源码：

```bash
pnpm --dir apps/web build
mvn -f backend/pom.xml test
bash scripts/smoke.sh
```

前端 Dockerfile 与后端 Dockerfile 均为多阶段/独立构建，不依赖开发机已有的 `dist`、`target` 或 `node_modules`。

## 6. 备份与恢复

- 达梦数据卷：`shouxin-dameng-data`；
- 达梦日志卷：`shouxin-dameng-logs`；
- 附件卷：`shouxin-uploads`。

生产环境应使用达梦官方备份工具配置每日增量、每周全量备份，并定期执行异机恢复演练。附件卷需与数据库保持同一恢复点。不要通过删除 volume 的方式重建服务。

## 7. 安全与上线检查

- 在上层反向代理配置 HTTPS、可信证书和安全响应头；
- 关闭后端 3000、达梦 5236 对公网暴露，仅保留内网访问；
- 替换所有初始密码，采用最小权限角色；
- 配置日志采集、磁盘/内存/接口健康告警和数据库备份告警；
- 验证附件大小、JWT 有效期、审核超期阈值等系统参数；
- 使用客户正式达梦授权，固定镜像摘要并进行漏洞扫描；
- 上线前执行完整生命周期、权限隔离、导入导出和 50 并发验收。

## 8. 源码保护交付

客户运行系统不需要获得源码。可交付经过签名和漏洞扫描的前端、后端、达梦镜像归档，以及 Compose、环境变量模板、部署说明、数据库迁移和授权文件。前端浏览器端资源天然可被检查，不能作为秘密载体；密钥、数据库密码和服务端规则只保存在服务器环境及后端。
