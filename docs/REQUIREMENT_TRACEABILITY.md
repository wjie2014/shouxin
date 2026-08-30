# 需求追踪矩阵（V3.0）

| 需求域 | 实现位置 | 验证方式 | 状态 |
|---|---|---|---|
| 工作台六指标、待办、领域分布、30天趋势、快捷入口 | `Dashboard`、`DashboardController` | 页面与 `/api/statistics/dashboard` | 已实现 |
| 问答列表筛选、排序、批量、分页、Excel | `Pairs`、`QaPairController`、`TemplateExportController` | 列表 API、导出文件校验 | 已实现 |
| 详情五页签与流转进度 | `QaDetailModal`、问答/版本/审核/附件接口 | 详情操作回归 | 已实现 |
| 富文本、图片、表格、附件、三级目录 | `RichTextEditor`、`FileDropInput`、`CreatePair` | 创建/编辑及附件回归 | 已实现 |
| 导入模板、预览、确认、多 Sheet | `TemplateImportController`、导入弹窗 | 两份原始模板回归 | 已实现 |
| 待审核列表、审核详情、批量审核、历史 | `Reviews`、`ReviewHistory`、`ReviewController` | 指定人员三级流程回归 | 已实现 |
| 字段方案 13 类型及动态表单 | `FieldSchemeUI`、`FieldSchemeService` | 默认方案创建与配置 CRUD | 已实现 |
| 三级目录树 CRUD、排序、导入导出 | `Domains`、`DomainAdminController`、`DomainExcelController` | 77 行导出回导校验 | 已实现 |
| 按业务域审核流程可视化配置 | `FlowConfig`、`ReviewFlowAdminController`、`ReviewWorkflow` | 1/2/3级、人员与规则回归 | 已实现 |
| 运营仪表盘和自定义分析 | `CustomStats`、`AnalysisService`、ECharts | 8 种模式、下钻与 Excel 回归 | 已实现 |
| 用户、角色权限、日志、参数 | `Admin` 及 admin/audit 控制器 | CRUD 与权限 HTTP 回归 | 已实现 |
| 中文状态、统一日期和 UI 规范 | `statusLabel`、`dateTime`、全局 CSS | 构建与页面核对 | 已实现 |
| 多页签与状态记忆 | `App`、`useStoredState` | 切换、刷新、关闭清理 | 已实现 |
| JWT、RBAC、数据隔离、审计、密码加密 | security/auth/access/audit 模块 | 角色账号及越权回归 | 已实现 |
| 预置角色、账号、目录、字段方案、模拟数据 | V001～V012 数据迁移 | 达梦数据/API 核对 | 已实现 |
| 私有化容器部署 | Dockerfiles、Compose、Nginx、scripts、部署文档 | Compose 校验和镜像构建 | 已实现 |

“知识命中率、搜索反馈、满意度”不从问答表伪推导；V009 已增加行为事件和反馈统计表，`/api/analysis/events`、`/api/analysis/feedback` 提供埋点入口，分析工作台的“使用与反馈”读取真实事件数据。
