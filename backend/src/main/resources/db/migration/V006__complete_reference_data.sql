-- 完整方案：覆盖需求文档定义的扩展字段类型
INSERT INTO qa_field_scheme(id, scheme_code, scheme_name, description, is_default, enabled)
SELECT 'scheme-complete', 'COMPLETE', '完整方案', '覆盖全部问答对扩展字段类型的标准方案', 0, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_scheme WHERE id = 'scheme-complete');

INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order, options_json)
SELECT 'complete-question-type','scheme-complete','questionType','问题类型','ENUM',0,1,1,1,'[{"value":"knowledge","label":"知识类"},{"value":"operation","label":"操作类"},{"value":"fault","label":"故障类"},{"value":"management","label":"管理类"}]' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-question-type');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order)
SELECT 'complete-reference','scheme-complete','referenceDoc','依据文档','TEXT',0,1,1,2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-reference');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order)
SELECT 'complete-scope','scheme-complete','scope','适用范围','TEXTAREA',0,1,1,3 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-scope');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order)
SELECT 'complete-author','scheme-complete','author','编写人','USER',1,1,1,4 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-author');
INSERT INTO qa_field_config(id, scheme_id, field_code, field_name, field_type, required, list_visible, searchable, sort_order)
SELECT 'complete-attachments','scheme-complete','attachments','附件','ATTACHMENT',0,0,0,5 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-attachments');

-- 便于验收和联调的审计样例，使用幂等键避免重复插入。
INSERT INTO sys_operation_log(id, operator_id, operation_type, operation_content, target_type, target_id, client_ip)
SELECT 'log-seed-login','user-admin','LOGIN','管理员登录（初始化样例）','SYSTEM',NULL,'127.0.0.1' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_operation_log WHERE id='log-seed-login');
INSERT INTO sys_operation_log(id, operator_id, operation_type, operation_content, target_type, target_id, client_ip)
SELECT 'log-seed-config','user-admin','CONFIG_UPDATE','初始化默认三级审核流程','REVIEW_FLOW',NULL,'127.0.0.1' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_operation_log WHERE id='log-seed-config');
