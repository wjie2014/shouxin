CREATE TABLE IF NOT EXISTS sys_permission (
    id VARCHAR(36) NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    permission_type VARCHAR(16) NOT NULL,
    parent_id VARCHAR(36),
    sort_order INT DEFAULT 0 NOT NULL,
    CONSTRAINT pk_sys_permission PRIMARY KEY (id),
    CONSTRAINT uk_sys_permission_code UNIQUE (permission_code),
    CONSTRAINT fk_sys_permission_parent FOREIGN KEY (parent_id) REFERENCES sys_permission(id)
);

CREATE TABLE IF NOT EXISTS sys_role_permission (
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_role_permission PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_srp_role FOREIGN KEY (role_id) REFERENCES sys_role(id),
    CONSTRAINT fk_srp_permission FOREIGN KEY (permission_id) REFERENCES sys_permission(id)
);

INSERT INTO sys_permission SELECT 'perm-dashboard','dashboard','工作台','MENU',NULL,10 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-dashboard');
INSERT INTO sys_permission SELECT 'perm-pairs','pairs','问答对管理','MENU',NULL,20 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-pairs');
INSERT INTO sys_permission SELECT 'perm-pairs-list','pairs:list','问答对列表','ACTION','perm-pairs',21 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-pairs-list');
INSERT INTO sys_permission SELECT 'perm-pairs-create','pairs:create','新建问答对','ACTION','perm-pairs',22 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-pairs-create');
INSERT INTO sys_permission SELECT 'perm-pairs-edit','pairs:edit','编辑与提交','ACTION','perm-pairs',23 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-pairs-edit');
INSERT INTO sys_permission SELECT 'perm-pairs-delete','pairs:delete','删除与退役','ACTION','perm-pairs',24 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-pairs-delete');
INSERT INTO sys_permission SELECT 'perm-review','review','审核管理','MENU',NULL,30 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-review');
INSERT INTO sys_permission SELECT 'perm-review-decision','review:decision','执行审核','ACTION','perm-review',31 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-review-decision');
INSERT INTO sys_permission SELECT 'perm-review-history','review:history','审核历史','ACTION','perm-review',32 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-review-history');
INSERT INTO sys_permission SELECT 'perm-config','config','配置管理','MENU',NULL,40 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-config');
INSERT INTO sys_permission SELECT 'perm-config-fields','config:fields','字段方案','ACTION','perm-config',41 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-config-fields');
INSERT INTO sys_permission SELECT 'perm-config-domains','config:domains','目录体系','ACTION','perm-config',42 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-config-domains');
INSERT INTO sys_permission SELECT 'perm-config-flows','config:flows','审核流程','ACTION','perm-config',43 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-config-flows');
INSERT INTO sys_permission SELECT 'perm-analysis','analysis','统计分析','MENU',NULL,50 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-analysis');
INSERT INTO sys_permission SELECT 'perm-analysis-dashboard','analysis:dashboard','运营仪表盘','ACTION','perm-analysis',51 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-analysis-dashboard');
INSERT INTO sys_permission SELECT 'perm-analysis-custom','analysis:custom','自定义分析','ACTION','perm-analysis',52 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-analysis-custom');
INSERT INTO sys_permission SELECT 'perm-system','system','系统管理','MENU',NULL,60 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-system');
INSERT INTO sys_permission SELECT 'perm-system-users','system:users','用户管理','ACTION','perm-system',61 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-system-users');
INSERT INTO sys_permission SELECT 'perm-system-roles','system:roles','角色管理','ACTION','perm-system',62 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-system-roles');
INSERT INTO sys_permission SELECT 'perm-system-logs','system:logs','操作日志','ACTION','perm-system',63 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-system-logs');
INSERT INTO sys_permission SELECT 'perm-system-params','system:params','系统参数','ACTION','perm-system',64 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_permission WHERE id='perm-system-params');

INSERT INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r CROSS JOIN sys_permission p
WHERE r.role_code='SYS_ADMIN' AND NOT EXISTS(SELECT 1 FROM sys_role_permission x WHERE x.role_id=r.id AND x.permission_id=p.id);

INSERT INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r JOIN sys_permission p ON p.permission_code IN
('dashboard','pairs','pairs:list','pairs:create','pairs:edit','pairs:delete','review','review:decision','review:history','config','config:fields','config:domains','config:flows','analysis','analysis:dashboard','analysis:custom')
WHERE r.role_code='QA_ADMIN' AND NOT EXISTS(SELECT 1 FROM sys_role_permission x WHERE x.role_id=r.id AND x.permission_id=p.id);

INSERT INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r JOIN sys_permission p ON p.permission_code IN
('dashboard','pairs','pairs:list','pairs:create','pairs:edit','review','review:history')
WHERE r.role_code='QA_SUBMITTER' AND NOT EXISTS(SELECT 1 FROM sys_role_permission x WHERE x.role_id=r.id AND x.permission_id=p.id);

INSERT INTO sys_role_permission(role_id,permission_id)
SELECT r.id,p.id FROM sys_role r JOIN sys_permission p ON p.permission_code IN
('dashboard','pairs','pairs:list','review','review:decision','review:history','analysis','analysis:dashboard','analysis:custom')
WHERE r.role_code IN ('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3') AND NOT EXISTS(SELECT 1 FROM sys_role_permission x WHERE x.role_id=r.id AND x.permission_id=p.id);
