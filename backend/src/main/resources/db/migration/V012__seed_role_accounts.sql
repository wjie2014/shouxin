-- 联调与验收账号，初始密码与 admin 一致（admin123），首次登录后应修改。
INSERT INTO sys_user(id,username,real_name,password_hash,email,unit_id,enabled,must_change_password)
SELECT 'user-submitter','submitter','问答整理员','$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.','submitter@example.local','unit-head',1,1 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_user WHERE username='submitter');
INSERT INTO sys_user(id,username,real_name,password_hash,email,unit_id,enabled,must_change_password)
SELECT 'user-review-l1','reviewer1','一级审核员','$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.','reviewer1@example.local','unit-head',1,1 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_user WHERE username='reviewer1');
INSERT INTO sys_user(id,username,real_name,password_hash,email,unit_id,enabled,must_change_password)
SELECT 'user-review-l2','reviewer2','二级审核员','$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.','reviewer2@example.local','unit-head',1,1 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_user WHERE username='reviewer2');
INSERT INTO sys_user(id,username,real_name,password_hash,email,unit_id,enabled,must_change_password)
SELECT 'user-review-l3','reviewer3','三级审核员','$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.','reviewer3@example.local','unit-head',1,1 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_user WHERE username='reviewer3');
INSERT INTO sys_user(id,username,real_name,password_hash,email,unit_id,enabled,must_change_password)
SELECT 'user-qa-admin','qaadmin','问答对管理员','$2b$12$cddOU/ff8BtLFKfjHhpm6.D7OVxLnvkJr2v1H5Da3fyhQNF2stB5.','qaadmin@example.local','unit-head',1,1 FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM sys_user WHERE username='qaadmin');

INSERT INTO sys_user_role(user_id,role_id) SELECT u.id,'role-submitter' FROM sys_user u WHERE u.username='submitter' AND NOT EXISTS(SELECT 1 FROM sys_user_role ur WHERE ur.user_id=u.id AND ur.role_id='role-submitter');
INSERT INTO sys_user_role(user_id,role_id) SELECT u.id,'role-review-l1' FROM sys_user u WHERE u.username='reviewer1' AND NOT EXISTS(SELECT 1 FROM sys_user_role ur WHERE ur.user_id=u.id AND ur.role_id='role-review-l1');
INSERT INTO sys_user_role(user_id,role_id) SELECT u.id,'role-review-l2' FROM sys_user u WHERE u.username='reviewer2' AND NOT EXISTS(SELECT 1 FROM sys_user_role ur WHERE ur.user_id=u.id AND ur.role_id='role-review-l2');
INSERT INTO sys_user_role(user_id,role_id) SELECT u.id,'role-review-l3' FROM sys_user u WHERE u.username='reviewer3' AND NOT EXISTS(SELECT 1 FROM sys_user_role ur WHERE ur.user_id=u.id AND ur.role_id='role-review-l3');
INSERT INTO sys_user_role(user_id,role_id) SELECT u.id,'role-qa-admin' FROM sys_user u WHERE u.username='qaadmin' AND NOT EXISTS(SELECT 1 FROM sys_user_role ur WHERE ur.user_id=u.id AND ur.role_id='role-qa-admin');

-- 仅替换尚未人工配置、且唯一审核人为 admin 的初始流程节点。
DELETE FROM qa_review_flow_reviewer r
WHERE r.user_id='user-admin'
  AND r.node_id IN (
    SELECT n.id FROM qa_review_flow_node n JOIN qa_review_flow f ON f.id=n.flow_id
    WHERE f.flow_version=1 AND f.id LIKE 'flow-domain-%'
      AND (SELECT COUNT(*) FROM qa_review_flow_reviewer x WHERE x.node_id=n.id)=1
  );
INSERT INTO qa_review_flow_reviewer(node_id,user_id)
SELECT n.id,(SELECT u.id FROM sys_user u WHERE u.username=CASE n.level_no WHEN 1 THEN 'reviewer1' WHEN 2 THEN 'reviewer2' ELSE 'reviewer3' END FETCH FIRST 1 ROWS ONLY)
FROM qa_review_flow_node n JOIN qa_review_flow f ON f.id=n.flow_id
WHERE f.flow_version=1 AND f.id LIKE 'flow-domain-%'
  AND NOT EXISTS(SELECT 1 FROM qa_review_flow_reviewer r WHERE r.node_id=n.id);
