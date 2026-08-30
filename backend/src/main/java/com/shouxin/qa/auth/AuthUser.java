package com.shouxin.qa.auth;

import java.util.List;

public record AuthUser(String id, String username, String realName, String passwordHash,
                       boolean enabled, boolean mustChangePassword, int authVersion, List<String> roles) {
}
