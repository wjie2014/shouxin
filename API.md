# API 与模块清单

后端采用 Spring Boot 3.5 / Java 17，DM8 通过 JDBC 访问，JWT 无状态认证，所有写操作使用事务并写入 `sys_operation_log`。

| 模块 | 接口 |
|---|---|
| 认证 | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/change-password` |
| 问答对 | `GET/POST /api/qa-pairs`（支持目录、状态、日期、排序、分页）、`GET /api/qa-pairs/{id}`、`POST .../{id}/submit`、`POST .../{id}/update`、`POST .../{id}/retire`、`DELETE .../{id}`、`POST /api/qa-pairs/batch/submit`、`POST /api/qa-pairs/batch/delete` |
| 审核 | `GET /api/reviews/pending`、`POST /api/reviews/{id}/decision`、`GET /api/reviews/history` |
| 目录 | `GET /api/domains`、`GET /api/domains/tree`；管理员可通过 `/api/admin/domains` 增删改 |
| 配置 | `GET /api/field-schemes`、`GET /api/field-schemes/{id}`、`/api/admin/field-schemes/**`、`/api/admin/domains/**`、`/api/admin/review-flows/**` |
| 导入 | `POST /api/import/first-stage/preview`、`POST /api/import/first-stage/confirm`、`POST /api/import/first-stage`、`POST /api/import/second-stage` |
| 统计 | `GET /api/statistics/dashboard`、`GET /api/statistics/trend`、`POST /api/statistics/custom` |

数据库启动时由 `DatabaseMigrationRunner` 按版本执行 `db/migration/V*.sql`，并以 SHA-256 校验已执行脚本不可漂移。所有列表接口支持分页上限，输入由 Bean Validation 校验，错误统一返回 JSON。
