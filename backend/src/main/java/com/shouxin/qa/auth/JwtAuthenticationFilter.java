package com.shouxin.qa.auth;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService jwt;
    private final AuthUserService users;

    public JwtAuthenticationFilter(JwtTokenService jwt, AuthUserService users) { this.jwt = jwt; this.users = users; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwt.parse(header.substring(7));
                // Roles are loaded from DM8 on every request. The JWT roles claim is
                // informational only, so disabling a user/role takes effect immediately.
                AuthUser current = users.findByUsername(claims.get("username", String.class));
                List<String> roles = current.roles();
                var authorities = roles == null ? List.<SimpleGrantedAuthority>of() : roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
                SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(current.username(), null, authorities));
            } catch (RuntimeException ignored) {
                // Invalid/expired tokens are treated as anonymous; Spring Security returns 401.
            }
        }
        chain.doFilter(request, response);
    }
}
