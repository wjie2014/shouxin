package com.shouxin.qa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class QualityAnswerApplication {
    public static void main(String[] args) {
        SpringApplication.run(QualityAnswerApplication.class, args);
    }
}
