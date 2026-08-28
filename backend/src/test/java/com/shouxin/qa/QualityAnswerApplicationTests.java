package com.shouxin.qa;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration",
        "app.jwt.secret=test-secret-that-is-at-least-32-characters-long"
})
class QualityAnswerApplicationTests {
    @MockBean
    JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
    }
}
