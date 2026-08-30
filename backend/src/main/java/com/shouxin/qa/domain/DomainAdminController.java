package com.shouxin.qa.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/domains")
@PreAuthorize("hasAuthority('config:domains')")
public class DomainAdminController {
    private final JdbcTemplate jdbc;
    public DomainAdminController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@Valid @RequestBody CreateDomainRequest request) {
        int level = request.parentId() == null || request.parentId().isBlank() ? 1 : Integer.parseInt(String.valueOf(jdbc.queryForObject("SELECT level_no FROM qa_domain WHERE id = ? AND deleted = 0", Integer.class, request.parentId()))) + 1;
        if (level > 3) throw new IllegalArgumentException("目录最多支持三级");
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO qa_domain(id, parent_id, domain_code, domain_name, level_no, path, sort_order,description) VALUES (?, ?, ?, ?, ?, ?, ?,?)", id, blankToNull(request.parentId()), request.domainCode(), request.domainName(), level, request.domainName(), request.sortOrder(),request.description());
        if (level == 2) {
            String childId = UUID.randomUUID().toString();
            String childName = request.domainName() + "知识";
            String childCode = "L3-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            jdbc.update("INSERT INTO qa_domain(id, parent_id, domain_code, domain_name, level_no, path, sort_order) VALUES (?, ?, ?, ?, 3, ?, 1)",
                    childId, id, childCode, childName, request.domainName() + " / " + childName);
        }
        return jdbc.queryForMap("SELECT id, parent_id, domain_code, domain_name, level_no, path, sort_order FROM qa_domain WHERE id = ?", id);
    }

    @PutMapping("/{id}")
    @Transactional
    public void update(@PathVariable String id, @Valid @RequestBody UpdateDomainRequest request) {
        if (jdbc.update("UPDATE qa_domain SET domain_name = ?, description = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0", request.domainName(), request.description(), request.sortOrder(), id) != 1) throw new NoSuchElementException("目录不存在");
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable String id) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM qa_pair WHERE deleted=0 AND (domain_l1_id=? OR domain_l2_id=? OR domain_l3_id=?)", Integer.class, id,id,id)>0)
            throw new IllegalArgumentException("目录已被问答对使用，不能删除");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_flow WHERE domain_l1_id=? AND enabled=1", Integer.class,id)>0)
            throw new IllegalArgumentException("请先停用该目录的审核流程");
        Integer children = jdbc.queryForObject("SELECT COUNT(*) FROM qa_domain WHERE parent_id = ? AND deleted = 0", Integer.class, id);
        if (children != null && children > 0) throw new IllegalArgumentException("请先删除子目录");
        if (jdbc.update("UPDATE qa_domain SET deleted = 1, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0", id) != 1) throw new NoSuchElementException("目录不存在");
    }

    @PostMapping("/{id}/move")
    @Transactional
    public void move(@PathVariable String id, @RequestBody MoveRequest request) {
        if (request == null || !Set.of("up", "down").contains(request.direction())) throw new IllegalArgumentException("移动方向无效");
        Map<String,Object> current = jdbc.queryForList("SELECT id,parent_id,sort_order FROM qa_domain WHERE id=? AND deleted=0 FOR UPDATE", id).stream().findFirst().orElseThrow(() -> new NoSuchElementException("目录不存在"));
        Object parent = current.getOrDefault("parent_id", current.get("PARENT_ID"));
        int order = ((Number) current.getOrDefault("sort_order", current.get("SORT_ORDER"))).intValue();
        String operator = "up".equals(request.direction()) ? "<" : ">";
        String ordering = "up".equals(request.direction()) ? "DESC" : "ASC";
        List<Map<String,Object>> neighbor = parent == null
                ? jdbc.queryForList("SELECT id,sort_order FROM qa_domain WHERE parent_id IS NULL AND deleted=0 AND sort_order " + operator + " ? ORDER BY sort_order " + ordering + " FETCH FIRST 1 ROWS ONLY", order)
                : jdbc.queryForList("SELECT id,sort_order FROM qa_domain WHERE parent_id=? AND deleted=0 AND sort_order " + operator + " ? ORDER BY sort_order " + ordering + " FETCH FIRST 1 ROWS ONLY", parent, order);
        if (neighbor.isEmpty()) return;
        Object neighborId = neighbor.get(0).getOrDefault("id", neighbor.get(0).get("ID"));
        int neighborOrder = ((Number) neighbor.get(0).getOrDefault("sort_order", neighbor.get(0).get("SORT_ORDER"))).intValue();
        jdbc.update("UPDATE qa_domain SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", neighborOrder, id);
        jdbc.update("UPDATE qa_domain SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", order, neighborId);
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
    public record CreateDomainRequest(@NotBlank String domainCode, @NotBlank String domainName, String parentId, int sortOrder, String description) {}
    public record UpdateDomainRequest(@NotBlank String domainName, String description, int sortOrder) {}
    public record MoveRequest(String direction) {}
}
