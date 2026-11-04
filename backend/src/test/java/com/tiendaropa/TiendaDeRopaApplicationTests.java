package com.tiendaropa;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("test")
class TiendaDeRopaApplicationTests {

    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("tiendaropa_test")
                    .withUsername("test")
                    .withPassword("test");

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",                postgres::getJdbcUrl);
        registry.add("spring.datasource.username",           postgres::getUsername);
        registry.add("spring.datasource.password",           postgres::getPassword);
        registry.add("spring.datasource.driver-class-name",  () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled",                () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto",        () -> "validate");
        registry.add("spring.jpa.database-platform",
                () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Test
    void contextLoads() {
    }
}
