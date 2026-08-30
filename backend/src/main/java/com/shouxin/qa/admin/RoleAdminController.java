package com.shouxin.qa.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/roles")
@PreAuthorize("hasAuthority('system:roles')")
public class RoleAdminController {
    private final JdbcTemplate jdbc;

    public RoleAdminController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public List<Map<String, Object>> list() {
        return jdbc.queryForList("""
                SELECT r.id,r.role_code,r.role_name,r.description,r.built_in,r.enabled,
                       LISTAGG(p.permission_code,',') WITHIN GROUP (ORDER BY p.sort_order) permission_codes
                  FROM sys_role r
                  LEFT JOIN sys_role_permission rp ON rp.role_id=r.id
                  LEFT JOIN sys_permission p ON p.id=rp.permission_id
                 GROUP BY r.id,r.role_code,r.role_name,r.description,r.built_in,r.enabled
                 ORDER BY r.built_in DESC,r.role_name
                """);
    }

    @GetMapping("/permissions/tree")
    public List<Map<String, Object>> permissionTree() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id,permission_code,permission_name,permission_type,parent_id,sort_order FROM sys_permission ORDER BY sort_order");
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        List<Map<String, Object>> roots = new ArrayList<>();
        for (Map<String, Object> source : rows) {
            Map<String, Object> node = new LinkedHashMap<>(source);
            node.put("children", new ArrayList<Map<String, Object>>());
            byId.put(String.valueOf(value(source, "id")), node);
        }
        for (Map<String, Object> node : byId.values()) {
            Object parent = value(node, "parent_id");
            if (parent == null) roots.add(node);
            else {
                Map<String, Object> parentNode = byId.get(String.valueOf(parent));
                if (parentNode != null) children(parentNode).add(node);
            }
        }
        return roots;
    }

    @GetMapping("/{roleId}/permissions")
    public List<String> rolePermissions(@PathVariable String roleId) {
        requireRole(roleId);
        return jdbc.query("SELECT p.permission_code FROM sys_permission p JOIN sys_role_permission rp ON rp.permission_id=p.id WHERE rp.role_id=? ORDER BY p.sort_order", (rs, n) -> rs.getString(1), roleId);
    }

    @PutMapping("/{roleId}/permissions")
    @Transactional
    public void setPermissions(@PathVariable String roleId, @RequestBody PermissionRequest request) {
        requireRole(roleId);
        List<String> codes = request.permissionCodes() == null ? List.of() : request.permissionCodes().stream().filter(Objects::nonNull).map(String::trim).filter(x -> !x.isBlank()).distinct().toList();
        jdbc.update("DELETE FROM sys_role_permission WHERE role_id=?", roleId);
        for (String code : codes) {
            int inserted = jdbc.update("INSERT INTO sys_role_permission(role_id,permission_id) SELECT ?,id FROM sys_permission WHERE permission_code=?", roleId, code);
            if (inserted != 1) throw new IllegalArgumentException("权限不存在：" + code);
        }
    }

    @GetMapping("/user/{userId}")
    public List<Map<String, Object>> userRoles(@PathVariable String userId) {
        return jdbc.queryForList("SELECT r.id,r.role_code,r.role_name FROM sys_role r JOIN sys_user_role ur ON ur.role_id=r.id WHERE ur.user_id=?", userId);
    }

    @PutMapping("/user/{userId}")
    @Transactional
    public void setUserRoles(@PathVariable String userId, @RequestBody RoleRequest request) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE id=?", Integer.class, userId) != 1) throw new NoSuchElementException("用户不存在");
        jdbc.update("DELETE FROM sys_user_role WHERE user_id=?", userId);
        if (request.roleCodes() != null) for (String code : request.roleCodes()) {
            if (jdbc.update("INSERT INTO sys_user_role(user_id,role_id) SELECT ?,id FROM sys_role WHERE role_code=? AND enabled=1", userId, code) != 1)
                throw new IllegalArgumentException("角色不存在或已停用：" + code);
        }
    }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody RoleDef request) {
        validate(request, true);
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO sys_role(id,role_code,role_name,description,built_in,enabled) VALUES(?,?,?,?,0,?)", id, request.roleCode().trim(), request.roleName().trim(), request.description(), request.enabled() ? 1 : 0);
        setPermissions(id, new PermissionRequest(request.permissionCodes()));
        return jdbc.queryForMap("SELECT id,role_code,role_name,description,built_in,enabled FROM sys_role WHERE id=?", id);
    }

    @PutMapping("/definition/{id}")
    @Transactional
    public void updateRole(@PathVariable String id, @RequestBody RoleDef request) {
        validate(request, false);
        if (jdbc.update("UPDATE sys_role SET role_name=?,description=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", request.roleName().trim(), request.description(), request.enabled() ? 1 : 0, id) != 1)
            throw new NoSuchElementException("角色不存在");
        if (request.permissionCodes() != null) setPermissions(id, new PermissionRequest(request.permissionCodes()));
    }

    @DeleteMapping("/definition/{id}")
    @Transactional
    public void deleteRole(@PathVariable String id) {
        Integer used = jdbc.queryForObject("SELECT COUNT(*) FROM sys_user_role WHERE role_id=?", Integer.class, id);
        if (used != null && used > 0) throw new IllegalArgumentException("该角色已分配给用户，不能删除");
        jdbc.update("DELETE FROM sys_role_permission WHERE role_id=?", id);
        if (jdbc.update("DELETE FROM sys_role WHERE id=? AND built_in=0", id) != 1) throw new IllegalArgumentException("内置角色不可删除或角色不存在");
    }

    private void validate(RoleDef request, boolean requireCode) {
        if (request == null || request.roleName() == null || request.roleName().isBlank() || (requireCode && (request.roleCode() == null || request.roleCode().isBlank())))
            throw new IllegalArgumentException("角色编码和名称不能为空");
        if (request.roleCode() != null && !request.roleCode().isBlank() && !request.roleCode().matches("[A-Z][A-Z0-9_]{1,63}"))
            throw new IllegalArgumentException("角色编码须为大写字母、数字或下划线");
    }

    private void requireRole(String id) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM sys_role WHERE id=?", Integer.class, id) != 1) throw new NoSuchElementException("角色不存在");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> children(Map<String, Object> node) { return (List<Map<String, Object>>) node.get("children"); }
    private Object value(Map<String, Object> row, String key) { return row.getOrDefault(key, row.get(key.toUpperCase(Locale.ROOT))); }

    public record RoleRequest(List<String> roleCodes) {}
    public record PermissionRequest(List<String> permissionCodes) {}
    public record RoleDef(String roleCode, String roleName, String description, boolean enabled, List<String> permissionCodes) {}
}
