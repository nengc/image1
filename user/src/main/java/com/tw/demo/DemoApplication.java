package com.tw.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
//@ComponentScan(basePackages = {"com.tw.demo.*"})
@ComponentScan(basePackages = {
        "com.tw.demo.adapters",
        "com.tw.demo.adapters.in.web",
        "com.tw.demo.application.service",
        "com.tw.demo.adapters.out.persistence"})
@EntityScan("com.tw.demo.adapters.out.persistence.entities")
@EnableJpaRepositories(basePackages = "com.tw.demo.adapters.out.persistence.repositories")
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}