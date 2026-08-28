-- 达梦 DM8 核心业务模型。所有删除采用逻辑删除，所有审核和版本记录保留。

CREATE TABLE sys_unit (
    id VARCHAR(36) NOT NULL,
    unit_code VARCHAR(64) NOT NULL,
    unit_name VARCHAR(200) NOT NULL,
    parent_id VARCHAR(36),
    enabled INT DEFAULT 1 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_unit PRIMARY KEY (id),
    CONSTRAINT uk_sys_unit_code UNIQUE (unit_code)
);

CREATE TABLE sys_user (
    id VARCHAR(36) NOT NULL,
    username VARCHAR(64) NOT NULL,
    real_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(200),
    mobile VARCHAR(32),
    unit_id VARCHAR(36),
    enabled INT DEFAULT 1 NOT NULL,
    must_change_password INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP,
    CONSTRAINT pk_sys_user PRIMARY KEY (id),
    CONSTRAINT uk_sys_user_username UNIQUE (username),
    CONSTRAINT fk_sys_user_unit FOREIGN KEY (unit_id) REFERENCES sys_unit(id)
);

CREATE TABLE sys_role (
    id VARCHAR(36) NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    built_in INT DEFAULT 0 NOT NULL,
    enabled INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_role PRIMARY KEY (id),
    CONSTRAINT uk_sys_role_code UNIQUE (role_code)
);

CREATE TABLE sys_user_role (
    user_id VARCHAR(36) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_user_role PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_sur_user FOREIGN KEY (user_id) REFERENCES sys_user(id),
    CONSTRAINT fk_sur_role FOREIGN KEY (role_id) REFERENCES sys_role(id)
);

CREATE TABLE qa_domain (
    id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36),
    domain_code VARCHAR(64) NOT NULL,
    domain_name VARCHAR(200) NOT NULL,
    level_no INT NOT NULL,
    path VARCHAR(1000),
    description VARCHAR(500),
    sort_order INT DEFAULT 0 NOT NULL,
    enabled INT DEFAULT 1 NOT NULL,
    deleted INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_domain PRIMARY KEY (id),
    CONSTRAINT uk_qa_domain_code UNIQUE (domain_code),
    CONSTRAINT fk_qa_domain_parent FOREIGN KEY (parent_id) REFERENCES qa_domain(id)
);

CREATE TABLE qa_pair (
    id VARCHAR(36) NOT NULL,
    qa_code VARCHAR(64) NOT NULL,
    current_version_id VARCHAR(36),
    domain_l1_id VARCHAR(36) NOT NULL,
    domain_l2_id VARCHAR(36) NOT NULL,
    domain_l3_id VARCHAR(36),
    author_id VARCHAR(36) NOT NULL,
    unit_id VARCHAR(36),
    status VARCHAR(32) NOT NULL,
    deleted INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_pair PRIMARY KEY (id),
    CONSTRAINT uk_qa_pair_code UNIQUE (qa_code),
    CONSTRAINT fk_qa_pair_author FOREIGN KEY (author_id) REFERENCES sys_user(id),
    CONSTRAINT fk_qa_pair_unit FOREIGN KEY (unit_id) REFERENCES sys_unit(id),
    CONSTRAINT fk_qa_pair_d1 FOREIGN KEY (domain_l1_id) REFERENCES qa_domain(id),
    CONSTRAINT fk_qa_pair_d2 FOREIGN KEY (domain_l2_id) REFERENCES qa_domain(id),
    CONSTRAINT fk_qa_pair_d3 FOREIGN KEY (domain_l3_id) REFERENCES qa_domain(id)
);

CREATE TABLE qa_pair_version (
    id VARCHAR(36) NOT NULL,
    qa_pair_id VARCHAR(36) NOT NULL,
    version_no VARCHAR(32) NOT NULL,
    question_html CLOB NOT NULL,
    question_text CLOB NOT NULL,
    answer_html CLOB NOT NULL,
    answer_text CLOB NOT NULL,
    reference_doc VARCHAR(500),
    extension_data CLOB,
    version_status VARCHAR(32) NOT NULL,
    change_reason VARCHAR(1000),
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submitted_at TIMESTAMP,
    published_at TIMESTAMP,
    retired_at TIMESTAMP,
    CONSTRAINT pk_qa_pair_version PRIMARY KEY (id),
    CONSTRAINT uk_qa_pair_version UNIQUE (qa_pair_id, version_no),
    CONSTRAINT fk_qpv_pair FOREIGN KEY (qa_pair_id) REFERENCES qa_pair(id),
    CONSTRAINT fk_qpv_creator FOREIGN KEY (created_by) REFERENCES sys_user(id)
);

CREATE TABLE qa_review_flow (
    id VARCHAR(36) NOT NULL,
    domain_l1_id VARCHAR(36) NOT NULL,
    flow_version INT NOT NULL,
    pass_rule VARCHAR(16) NOT NULL,
    enabled INT DEFAULT 1 NOT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_review_flow PRIMARY KEY (id),
    CONSTRAINT uk_qa_review_flow_version UNIQUE (domain_l1_id, flow_version),
    CONSTRAINT fk_qrf_domain FOREIGN KEY (domain_l1_id) REFERENCES qa_domain(id)
);

CREATE TABLE qa_review_flow_node (
    id VARCHAR(36) NOT NULL,
    flow_id VARCHAR(36) NOT NULL,
    level_no INT NOT NULL,
    node_name VARCHAR(200) NOT NULL,
    CONSTRAINT pk_qa_review_flow_node PRIMARY KEY (id),
    CONSTRAINT uk_qrfn_level UNIQUE (flow_id, level_no),
    CONSTRAINT fk_qrfn_flow FOREIGN KEY (flow_id) REFERENCES qa_review_flow(id)
);

CREATE TABLE qa_review_flow_reviewer (
    node_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    CONSTRAINT pk_qa_review_flow_reviewer PRIMARY KEY (node_id, user_id),
    CONSTRAINT fk_qrfr_node FOREIGN KEY (node_id) REFERENCES qa_review_flow_node(id),
    CONSTRAINT fk_qrfr_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_review_task (
    id VARCHAR(36) NOT NULL,
    version_id VARCHAR(36) NOT NULL,
    flow_id VARCHAR(36) NOT NULL,
    level_no INT NOT NULL,
    reviewer_id VARCHAR(36) NOT NULL,
    task_status VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    CONSTRAINT pk_qa_review_task PRIMARY KEY (id),
    CONSTRAINT uk_qa_review_task UNIQUE (version_id, level_no, reviewer_id),
    CONSTRAINT fk_qrt_version FOREIGN KEY (version_id) REFERENCES qa_pair_version(id),
    CONSTRAINT fk_qrt_flow FOREIGN KEY (flow_id) REFERENCES qa_review_flow(id),
    CONSTRAINT fk_qrt_reviewer FOREIGN KEY (reviewer_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_review_record (
    id VARCHAR(36) NOT NULL,
    version_id VARCHAR(36) NOT NULL,
    level_no INT NOT NULL,
    reviewer_id VARCHAR(36) NOT NULL,
    result VARCHAR(16) NOT NULL,
    opinion VARCHAR(2000),
    suggestion VARCHAR(2000),
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_review_record PRIMARY KEY (id),
    CONSTRAINT fk_qrr_version FOREIGN KEY (version_id) REFERENCES qa_pair_version(id),
    CONSTRAINT fk_qrr_reviewer FOREIGN KEY (reviewer_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_attachment (
    id VARCHAR(36) NOT NULL,
    version_id VARCHAR(36) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    object_key VARCHAR(1000) NOT NULL,
    content_type VARCHAR(200),
    size_bytes BIGINT,
    checksum VARCHAR(128),
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_attachment PRIMARY KEY (id),
    CONSTRAINT fk_qaa_version FOREIGN KEY (version_id) REFERENCES qa_pair_version(id),
    CONSTRAINT fk_qaa_creator FOREIGN KEY (created_by) REFERENCES sys_user(id)
);

CREATE TABLE qa_field_scheme (
    id VARCHAR(36) NOT NULL,
    scheme_code VARCHAR(64) NOT NULL,
    scheme_name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    is_default INT DEFAULT 0 NOT NULL,
    enabled INT DEFAULT 1 NOT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_field_scheme PRIMARY KEY (id),
    CONSTRAINT uk_qa_field_scheme_code UNIQUE (scheme_code)
);

CREATE TABLE qa_field_config (
    id VARCHAR(36) NOT NULL,
    scheme_id VARCHAR(36) NOT NULL,
    field_code VARCHAR(64) NOT NULL,
    field_name VARCHAR(200) NOT NULL,
    field_type VARCHAR(32) NOT NULL,
    required INT DEFAULT 0 NOT NULL,
    list_visible INT DEFAULT 0 NOT NULL,
    searchable INT DEFAULT 0 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    options_json CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_field_config PRIMARY KEY (id),
    CONSTRAINT uk_qa_field_config_code UNIQUE (scheme_id, field_code),
    CONSTRAINT fk_qafc_scheme FOREIGN KEY (scheme_id) REFERENCES qa_field_scheme(id)
);

CREATE TABLE sys_operation_log (
    id VARCHAR(36) NOT NULL,
    operator_id VARCHAR(36),
    operation_type VARCHAR(64) NOT NULL,
    operation_content VARCHAR(2000) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(36),
    client_ip VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_operation_log PRIMARY KEY (id),
    CONSTRAINT fk_sol_operator FOREIGN KEY (operator_id) REFERENCES sys_user(id)
);

CREATE TABLE sys_config (
    config_key VARCHAR(128) NOT NULL,
    config_value CLOB,
    config_type VARCHAR(32) NOT NULL,
    description VARCHAR(500),
    updated_by VARCHAR(36),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_sys_config PRIMARY KEY (config_key)
);

CREATE INDEX idx_qa_pair_status ON qa_pair(status);
CREATE INDEX idx_qa_pair_author ON qa_pair(author_id);
CREATE INDEX idx_qa_pair_domain ON qa_pair(domain_l1_id, domain_l2_id, domain_l3_id);
CREATE INDEX idx_qa_pair_version_pair ON qa_pair_version(qa_pair_id, created_at);
CREATE INDEX idx_qa_review_task_reviewer ON qa_review_task(reviewer_id, task_status);
CREATE INDEX idx_qa_review_task_version ON qa_review_task(version_id, level_no);
CREATE INDEX idx_qa_review_record_version ON qa_review_record(version_id, level_no, reviewed_at);
CREATE INDEX idx_sys_operation_log_time ON sys_operation_log(created_at);
