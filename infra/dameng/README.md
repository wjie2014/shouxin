# 神华知识问答对管理系统：达梦开发数据库

本目录用于 OrbStack / Docker 的 Apple Silicon（linux/arm64）开发环境。

## 启动

```bash
cp .env.example .env
# 编辑 .env，至少修改 DM_SYSDBA_PWD
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f dameng
```

连接参数：

- Host: `127.0.0.1`
- Port: `5236`
- User: `SYSDBA`
- Database/service: `DMSERVER`

## 说明

- 使用固定 ARM64 镜像标签，不使用 `latest`。
- 数据和日志使用命名卷，删除容器不会删除数据库文件。
- 该镜像来自社区维护，正式生产部署前应替换为客户授权的达梦官方镜像/安装包，并校验镜像摘要。
- 应用接入时使用独立业务账号，不要让应用使用 `SYSDBA`。
