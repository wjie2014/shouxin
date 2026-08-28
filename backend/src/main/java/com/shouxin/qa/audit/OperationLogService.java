package com.shouxin.qa.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class OperationLogService {
    private final JdbcTemplate jdbc;
    public OperationLogService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void record(String operatorId, String type, String content, String targetType, String targetId) {
        jdbc.update("INSERT INTO sys_operation_log(id, operator_id, operation_type, operation_content, target_type, target_id) VALUES (?, ?, ?, ?, ?, ?)", UUID.randomUUID().toString(), operatorId, type, content, targetType, targetId);
    }
}
