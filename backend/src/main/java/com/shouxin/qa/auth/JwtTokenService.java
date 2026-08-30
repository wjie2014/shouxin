package com.shouxin.qa.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtTokenService {
    private final SecretKey key;
    private final long accessTokenMinutes;

    public JwtTokenService(@Value("${app.jwt.secret}") String secret,
                           @Value("${app.jwt.access-token-minutes:30}") long accessTokenMinutes) {
        if (secret.length() < 32) throw new IllegalArgumentException("app.jwt.secret至少需要32个字符");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenMinutes = accessTokenMinutes;
    }

    public String create(AuthUser user) {
        Instant now = Instant.now();
        return Jwts.builder().subject(user.id()).claim("username", user.username()).claim("realName", user.realName())
                .claim("roles", user.roles()).claim("authVersion", user.authVersion()).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(accessTokenMinutes * 60)))
                .signWith(key).compact();
    }

    public Claims parse(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload(); }
}
