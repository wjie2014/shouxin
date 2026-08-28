-- 基础单位
INSERT INTO sys_unit(id, unit_code, unit_name, sort_order) SELECT 'unit-head', 'HEAD', '神华集团化工板块', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_unit WHERE id = 'unit-head');

-- 预置角色
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-submitter', 'QA_SUBMITTER', '问答对整理提交者', '负责问答对整理、新建和提交', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-submitter');
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-review-l1', 'QA_REVIEW_L1', '一审人员', '试点单位数据审核', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-review-l1');
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-review-l2', 'QA_REVIEW_L2', '二审专家', '数据组技术审核', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-review-l2');
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-review-l3', 'QA_REVIEW_L3', '三审专家', '数据组业务域审核', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-review-l3');
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-qa-admin', 'QA_ADMIN', '问答对管理员', '问答对全生命周期及配置管理', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-qa-admin');
INSERT INTO sys_role(id, role_code, role_name, description, built_in) SELECT 'role-sys-admin', 'SYS_ADMIN', '系统管理员', '用户、角色、日志和系统参数管理', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE id = 'role-sys-admin');

-- 11个一级目录
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-01', 'D01', '工艺技术', 1, '工艺技术', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-01');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-02', 'D02', '设备管理', 1, '设备管理', 2 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-02');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-03', 'D03', '安全环保', 1, '安全环保', 3 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-03');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-04', 'D04', '质量管理', 1, '质量管理', 4 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-04');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-05', 'D05', '生产调度', 1, '生产调度', 5 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-05');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-06', 'D06', '仪表自动化', 1, '仪表自动化', 6 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-06');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-07', 'D07', '电气管理', 1, '电气管理', 7 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-07');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-08', 'D08', '土建管理', 1, '土建管理', 8 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-08');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-09', 'D09', '仓储物流', 1, '仓储物流', 9 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-09');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-10', 'D10', '人力资源', 1, '人力资源', 10 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-10');
INSERT INTO qa_domain(id, domain_code, domain_name, level_no, path, sort_order) SELECT 'domain-11', 'D11', '综合管理', 1, '综合管理', 11 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_domain WHERE id = 'domain-11');

-- 默认字段方案
INSERT INTO qa_field_scheme(id, scheme_code, scheme_name, description, is_default) SELECT 'scheme-default', 'DEFAULT', '默认方案', '问答对基础字段方案', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_field_scheme WHERE id = 'scheme-default');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order) SELECT 'field-question', 'scheme-default', 'questionText', '问题', 'RICH_TEXT', 1, 1, 1, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id = 'field-question');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order) SELECT 'field-answer', 'scheme-default', 'answerText', '答案', 'RICH_TEXT', 1, 0, 1, 2 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id = 'field-answer');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order) SELECT 'field-reference-doc', 'scheme-default', 'referenceDoc', '依据文档', 'TEXT', 0, 1, 1, 3 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id = 'field-reference-doc');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order) SELECT 'field-author', 'scheme-default', 'author', '编写人', 'USER', 1, 1, 1, 4 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id = 'field-author');

INSERT INTO sys_config(config_key, config_value, config_type, description) SELECT 'review.default-levels', '3', 'NUMBER', '默认审核级数' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'review.default-levels');
INSERT INTO sys_config(config_key, config_value, config_type, description) SELECT 'security.force-change-default-password', 'true', 'BOOLEAN', '默认账号首次登录必须修改密码' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'security.force-change-default-password');
