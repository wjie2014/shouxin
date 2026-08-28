package com.shouxin.qa.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuthUserService implements UserDetailsService {
    private final JdbcTemplate jdbc;

    public AuthUserService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public AuthUser findByUsername(String username) {
        var users = jdbc.query("SELECT id, username, real_name, password_hash, enabled, must_change_password FROM sys_user WHERE username = ? AND enabled = 1",
                (rs, row) -> new AuthUser(rs.getString("id"), rs.getString("username"), rs.getString("real_name"),
                        rs.getString("password_hash"), rs.getInt("enabled") == 1, rs.getInt("must_change_password") == 1,
                        jdbc.query("SELECT r.role_code FROM sys_role r JOIN sys_user_role ur ON ur.role_id = r.id WHERE ur.user_id = ? AND r.enabled = 1",
                                (roleRs, roleRow) -> roleRs.getString(1), rs.getString("id"))), username);
        return users.stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("用户名或密码错误"));
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        AuthUser user = findByUsername(username);
        return User.withUsername(user.username()).password(user.passwordHash())
                .disabled(!user.enabled()).roles(user.roles().stream().map(this::roleName).toArray(String[]::new)).build();
    }

    private String roleName(String role) { return role.startsWith("ROLE_") ? role.substring(5) : role; }

    public void changePassword(String userId, String encodedPassword) {
        int updated = jdbc.update("UPDATE sys_user SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND enabled = 1", encodedPassword, userId);
        if (updated != 1) throw new IllegalStateException("用户不存在或已禁用");
    }

    public void updateLastLogin(String userId) {
        jdbc.update("UPDATE sys_user SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", userId);
    }
}
