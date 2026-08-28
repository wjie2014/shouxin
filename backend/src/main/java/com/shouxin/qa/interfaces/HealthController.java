package com.shouxin.qa.interfaces;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Integer db = jdbcTemplate.queryForObject("SELECT 1 FROM DUAL", Integer.class);
        return Map.of("status", "ok", "service", "shouxin-qa-platform-api", "database", db == 1 ? "ok" : "unknown");
    }
}
