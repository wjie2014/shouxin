package com.shouxin.qa.domain;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/domains")
public class DomainController {
    private final JdbcTemplate jdbc;
    public DomainController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> list(@RequestParam(required = false) Integer level, @RequestParam(required = false) String parentId) {
        if (level != null && (level < 1 || level > 3)) throw new IllegalArgumentException("目录层级必须为1、2或3");
        StringBuilder sql = new StringBuilder("SELECT id, parent_id, domain_code, domain_name, level_no, path, sort_order FROM qa_domain WHERE enabled = 1 AND deleted = 0");
        java.util.ArrayList<Object> args = new java.util.ArrayList<>();
        if (level != null) { sql.append(" AND level_no = ?"); args.add(level); }
        if (parentId != null && !parentId.isBlank()) { sql.append(" AND parent_id = ?"); args.add(parentId); }
        sql.append(" ORDER BY sort_order, domain_code");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/tree")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> tree() {
        var rows = jdbc.queryForList("SELECT id, parent_id, domain_code, domain_name, description, level_no, path, sort_order FROM qa_domain WHERE enabled = 1 AND deleted = 0 ORDER BY level_no, sort_order, domain_code");
        Map<String, Map<String,Object>> nodes = new java.util.LinkedHashMap<>();
        for (var row : rows) {
            var node = new java.util.LinkedHashMap<String,Object>(lowerKeys(row));
            node.put("domainName", value(row, "domain_name"));
            node.put("children", new java.util.ArrayList<Map<String,Object>>());
            nodes.put(String.valueOf(value(row, "id")), node);
        }
        List<Map<String,Object>> roots = new java.util.ArrayList<>();
        for (var node : nodes.values()) {
            var parent = nodes.get(String.valueOf(node.get("parent_id")));
            if (parent == null) roots.add(node);
            else {
                @SuppressWarnings("unchecked")
                var children = (List<Map<String,Object>>) parent.get("children");
                children.add(node);
            }
        }
        return roots;
    }

    private Map<String, Object> lowerKeys(Map<String, Object> row) {
        Map<String, Object> normalized = new java.util.LinkedHashMap<>();
        row.forEach((key, value) -> normalized.put(key.toLowerCase(java.util.Locale.ROOT), value));
        return normalized;
    }

    private Object value(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value != null ? value : row.get(key.toUpperCase(java.util.Locale.ROOT));
    }
}
