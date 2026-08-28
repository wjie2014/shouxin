package com.shouxin.qa.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import com.shouxin.qa.audit.OperationLogService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final AuthUserService users;
    private final JwtTokenService jwt;
    private final PasswordEncoder encoder;
    private final OperationLogService logs;

    public AuthController(AuthenticationManager authenticationManager, AuthUserService users, JwtTokenService jwt, PasswordEncoder encoder, OperationLogService logs) {
        this.authenticationManager = authenticationManager; this.users = users; this.jwt = jwt; this.encoder = encoder; this.logs = logs;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        AuthUser user = users.findByUsername(authentication.getName());
        users.updateLastLogin(user.id());
        logs.record(user.id(), "LOGIN", "用户登录", "SYSTEM", null);
        return Map.of("accessToken", jwt.create(user), "tokenType", "Bearer", "expiresIn", 1800,
                "user", Map.of("id", user.id(), "username", user.username(), "realName", user.realName(), "roles", user.roles(), "mustChangePassword", user.mustChangePassword()));
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) throw new IllegalArgumentException("两次输入的新密码不一致");
        if (request.newPassword().length() < 8) throw new IllegalArgumentException("新密码至少8位");
        AuthUser user = users.findByUsername(authentication.getName());
        if (!encoder.matches(request.oldPassword(), user.passwordHash())) throw new IllegalArgumentException("原密码错误");
        users.changePassword(user.id(), encoder.encode(request.newPassword()));
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        AuthUser user = users.findByUsername(authentication.getName());
        return Map.of("id", user.id(), "username", user.username(), "realName", user.realName(),
                "roles", user.roles(), "mustChangePassword", user.mustChangePassword());
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String oldPassword, @NotBlank String newPassword, @NotBlank String confirmPassword) {}
}
