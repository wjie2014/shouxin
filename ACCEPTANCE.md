# 交付验收记录

## 技术栈

- 后端：Java 17、Spring Boot 3.5、Spring Security、JWT、JDBC
- 数据库：达梦 DM8，应用用户与迁移用户分离
- 前端：React 19、TypeScript、Vite
- 部署：Docker Compose，支持 ARM64 OrbStack/Docker

## 已验证用例

1. DM8 容器启动、健康检查、数据卷持久化。
2. 管理员登录、JWT 鉴权、当前用户、角色权限拦截。
3. 问答对创建、分页查询、详情、逻辑删除。
4. 问答版本更新、重新提交、退役。
5. 提交审核后自动创建审核任务。
6. 一级、二级、三级审核通过和驳回流转。
7. 三级审核通过后自动发布并设置发布版本指针。
8. 第一阶段模板导入、导出。
9. 第二阶段模板导入、导出，按 11 个一级领域生成工作表。
10. 目录树、目录维护、字段方案和字段明细维护。
11. 附件上传、SHA-256、大小限制、下载。
12. 操作审计日志和工作台统计。
13. Maven 测试、React 生产构建、API/Web ARM64 镜像构建。

## 验收命令

```bash
mvn -q -f backend/pom.xml test
pnpm --dir apps/web build
DM_PASSWORD=*** JWT_SECRET=01234567890123456789012345678901 \
  docker compose -f docker-compose.prod.yml config
docker build -t shouxin-api:local backend
docker build -t shouxin-web:local apps/web
curl http://localhost:3000/health
```

## 上线前检查

- 将示例 JWT 密钥和本地数据库密码替换为部署密钥管理系统中的正式凭据。
- DM8 使用正式授权文件，配置备份、恢复演练、TLS 反向代理和集中日志。
- 首次登录后修改管理员密码，并按单位/角色创建真实用户。
- 对导入文件先在预生产环境执行校验，再进入生产库。
