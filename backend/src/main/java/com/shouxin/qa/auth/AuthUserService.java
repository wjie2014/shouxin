package com.shouxin.qa.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthUserService implements UserDetailsService {
    private final JdbcTemplate jdbc;

    public AuthUserService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public AuthUser findByUsername(String username) {
        var users = jdbc.query("SELECT id, username, real_name, password_hash, enabled, must_change_password, auth_version FROM sys_user WHERE username = ? AND enabled = 1",
                (rs, row) -> new AuthUser(rs.getString("id"), rs.getString("username"), rs.getString("real_name"),
                        rs.getString("password_hash"), rs.getInt("enabled") == 1, rs.getInt("must_change_password") == 1,
                        rs.getInt("auth_version"),
                        jdbc.query("SELECT r.role_code FROM sys_role r JOIN sys_user_role ur ON ur.role_id = r.id WHERE ur.user_id = ? AND r.enabled = 1",
                                (roleRs, roleRow) -> roleRs.getString(1), rs.getString("id"))), username);
        return users.stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("用户名或密码错误"));
    }

    public AuthUser findById(String id) {
        var users = jdbc.query("SELECT id, username, real_name, password_hash, enabled, must_change_password, auth_version FROM sys_user WHERE id = ? AND enabled = 1",
                (rs, row) -> new AuthUser(rs.getString("id"), rs.getString("username"), rs.getString("real_name"),
                        rs.getString("password_hash"), true, rs.getInt("must_change_password") == 1,
                        rs.getInt("auth_version"),
                        jdbc.query("SELECT r.role_code FROM sys_role r JOIN sys_user_role ur ON ur.role_id = r.id WHERE ur.user_id = ? AND r.enabled = 1",
                                (roleRs, roleRow) -> roleRs.getString(1), rs.getString("id"))), id);
        return users.stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("用户不存在或已禁用"));
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        AuthUser user = findByUsername(username);
        var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
        user.roles().forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + roleName(role))));
        permissions(user.id()).forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission)));
        return User.withUsername(user.username()).password(user.passwordHash())
                .disabled(!user.enabled()).authorities(authorities).build();
    }

    private String roleName(String role) { return role.startsWith("ROLE_") ? role.substring(5) : role; }

    public void changePassword(String userId, String encodedPassword) {
        int updated = jdbc.update("UPDATE sys_user SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND enabled = 1", encodedPassword, userId);
        if (updated != 1) throw new IllegalStateException("用户不存在或已禁用");
    }

    public void updateLastLogin(String userId) {
        jdbc.update("UPDATE sys_user SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", userId);
    }

    public List<String> permissions(String userId) {
        return jdbc.query("SELECT DISTINCT p.permission_code FROM sys_permission p JOIN sys_role_permission rp ON rp.permission_id=p.id JOIN sys_user_role ur ON ur.role_id=rp.role_id JOIN sys_role r ON r.id=ur.role_id WHERE ur.user_id=? AND r.enabled=1 ORDER BY p.permission_code", (rs,row)->rs.getString(1), userId);
    }
}
