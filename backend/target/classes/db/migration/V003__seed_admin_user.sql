INSERT INTO sys_user(id, username, real_name, password_hash, unit_id, enabled, must_change_password)
SELECT 'user-admin', 'admin', '系统管理员', '$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.', 'unit-head', 1, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'admin');

INSERT INTO sys_user_role(user_id, role_id)
SELECT 'user-admin', 'role-sys-admin' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_user_role WHERE user_id = 'user-admin' AND role_id = 'role-sys-admin');
