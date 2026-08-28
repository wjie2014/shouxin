package com.shouxin.qa.field;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/field-schemes")
public class FieldSchemeController {
    private final JdbcTemplate jdbc;
    public FieldSchemeController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> list() { return jdbc.queryForList("SELECT id, scheme_code, scheme_name, description, is_default, enabled, created_at, updated_at FROM qa_field_scheme WHERE enabled = 1 ORDER BY is_default DESC, scheme_name"); }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> get(@PathVariable String id) {
        var scheme = jdbc.queryForList("SELECT id, scheme_code, scheme_name, description, is_default, enabled, created_at, updated_at FROM qa_field_scheme WHERE id = ? AND enabled = 1", id).stream().findFirst().orElseThrow(() -> new NoSuchElementException("字段方案不存在"));
        var result = new LinkedHashMap<String, Object>(scheme);
        result.put("fields", jdbc.queryForList("SELECT id, field_code, field_name, field_type, required, list_visible, searchable, sort_order, options_json FROM qa_field_config WHERE scheme_id = ? ORDER BY sort_order", id));
        return result;
    }
}
