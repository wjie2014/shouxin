CREATE TABLE qa_analysis_scheme (
    id VARCHAR(36) NOT NULL,
    scheme_name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    owner_id VARCHAR(36) NOT NULL,
    visibility VARCHAR(16) DEFAULT 'PRIVATE' NOT NULL,
    config_json CLOB NOT NULL,
    built_in INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_analysis_scheme PRIMARY KEY (id),
    CONSTRAINT fk_qas_owner FOREIGN KEY (owner_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_analysis_subscription (
    id VARCHAR(36) NOT NULL,
    scheme_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    frequency VARCHAR(16) NOT NULL,
    run_hour INT DEFAULT 8 NOT NULL,
    enabled INT DEFAULT 1 NOT NULL,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_analysis_subscription PRIMARY KEY (id),
    CONSTRAINT fk_qasub_scheme FOREIGN KEY (scheme_id) REFERENCES qa_analysis_scheme(id),
    CONSTRAINT fk_qasub_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_analysis_report (
    id VARCHAR(36) NOT NULL,
    subscription_id VARCHAR(36),
    scheme_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    report_name VARCHAR(300) NOT NULL,
    file_path VARCHAR(1000),
    report_status VARCHAR(16) NOT NULL,
    error_message VARCHAR(1000),
    read_flag INT DEFAULT 0 NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_analysis_report PRIMARY KEY (id),
    CONSTRAINT fk_qar_subscription FOREIGN KEY (subscription_id) REFERENCES qa_analysis_subscription(id),
    CONSTRAINT fk_qar_scheme FOREIGN KEY (scheme_id) REFERENCES qa_analysis_scheme(id),
    CONSTRAINT fk_qar_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_knowledge_event (
    id VARCHAR(36) NOT NULL,
    event_type VARCHAR(24) NOT NULL,
    qa_pair_id VARCHAR(36),
    keyword VARCHAR(500),
    user_id VARCHAR(36),
    metadata_json CLOB,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_knowledge_event PRIMARY KEY (id),
    CONSTRAINT fk_qke_pair FOREIGN KEY (qa_pair_id) REFERENCES qa_pair(id),
    CONSTRAINT fk_qke_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
);

CREATE TABLE qa_feedback (
    id VARCHAR(36) NOT NULL,
    qa_pair_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    rating INT,
    helpful INT,
    comment_text VARCHAR(2000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_qa_feedback PRIMARY KEY (id),
    CONSTRAINT fk_qaf_pair FOREIGN KEY (qa_pair_id) REFERENCES qa_pair(id),
    CONSTRAINT fk_qaf_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
);

CREATE INDEX idx_qas_owner ON qa_analysis_scheme(owner_id, visibility);
CREATE INDEX idx_qasub_due ON qa_analysis_subscription(enabled, next_run_at);
CREATE INDEX idx_qar_user ON qa_analysis_report(user_id, generated_at);
CREATE INDEX idx_qke_time_type ON qa_knowledge_event(occurred_at, event_type);
CREATE INDEX idx_qke_pair ON qa_knowledge_event(qa_pair_id, occurred_at);
CREATE INDEX idx_qaf_pair ON qa_feedback(qa_pair_id, created_at);
