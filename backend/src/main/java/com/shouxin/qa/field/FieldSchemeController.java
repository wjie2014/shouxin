package com.shouxin.qa.field;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/field-schemes")
public class FieldSchemeController {
    private final JdbcTemplate jdbc;
    private final FieldSchemeService service;
    public FieldSchemeController(JdbcTemplate jdbc, FieldSchemeService service) { this.jdbc = jdbc; this.service = service; }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> list() { return jdbc.queryForList("SELECT id, scheme_code, scheme_name, description, is_default, enabled, created_at, updated_at FROM qa_field_scheme WHERE enabled = 1 ORDER BY is_default DESC, scheme_name"); }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> get(@PathVariable String id) {
        return service.scheme(id);
    }

    @GetMapping("/default")
    @PreAuthorize("isAuthenticated()")
    public Map<String,Object> defaultScheme(){return service.scheme(null);}
}
