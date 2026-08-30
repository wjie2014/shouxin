package com.shouxin.qa.database;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Lightweight, auditable migration runner for DM8. Migration files are applied
 * in lexical order and recorded with a checksum so changed historical scripts
 * fail fast instead of silently altering an existing database.
 */
@Component
@Order(0)
public class DatabaseMigrationRunner implements ApplicationRunner {
    private static final Pattern STATEMENT_SEPARATOR = Pattern.compile(";\\s*(?:\\r?\\n|$)");
    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS sys_schema_history (" +
                "version VARCHAR(128) NOT NULL, " +
                "checksum VARCHAR(64) NOT NULL, " +
                "installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, " +
                "CONSTRAINT pk_sys_schema_history PRIMARY KEY (version))");

        Resource[] resources = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:/db/migration/V*.sql");
        java.util.Arrays.sort(resources, java.util.Comparator.comparing(Resource::getFilename));
        for (Resource resource : resources) {
            String version = resource.getFilename();
            if (version == null) continue;
            String sql = resource.getContentAsString(StandardCharsets.UTF_8);
            String checksum = sha256(sql);
            var existing = jdbcTemplate.query("SELECT checksum FROM sys_schema_history WHERE version = ?",
                    (rs, rowNum) -> rs.getString(1), version);
            if (!existing.isEmpty()) {
                if (!checksum.equals(existing.get(0))) {
                    throw new IllegalStateException("Migration checksum mismatch: " + version);
                }
                continue;
            }
            for (String statement : STATEMENT_SEPARATOR.split(sql)) {
                String normalized = statement.replaceAll("(?m)^\\s*--.*$", "").trim();
                if (!normalized.isBlank()) jdbcTemplate.execute(normalized);
            }
            jdbcTemplate.update("INSERT INTO sys_schema_history(version, checksum) VALUES (?, ?)", version, checksum);
        }
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
