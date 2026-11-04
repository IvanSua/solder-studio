package com.tiendaropa.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Validates that all MANDATORY environment variables are set before the app fully starts.
 * Fails fast with a clear error message instead of cryptic runtime failures.
 */
@Slf4j
@Component
public class ConfigurationValidator implements ApplicationRunner {

    private final Environment env;

    public ConfigurationValidator(Environment env) {
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        String profile = Arrays.toString(env.getActiveProfiles());
        log.info("Running configuration validation for profiles: {}", profile);

        if (isProduction()) {
            validateProductionConfig();
        }

        validateJwtSecret();
    }

    private boolean isProduction() {
        return Arrays.asList(env.getActiveProfiles()).contains("prod");
    }

    private void validateJwtSecret() {
        String jwtSecret = env.getProperty("app.jwt.secret");
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "FATAL: JWT_SECRET environment variable is NOT SET. " +
                "Set it before starting the application. " +
                "Example: JWT_SECRET=your-256-bit-secret-here"
            );
        }
        if (jwtSecret.contains("dev-only-secret")) {
            log.warn("⚠️  WARNING: Using development-only JWT secret! Set JWT_SECRET env var for production.");
        } else if (jwtSecret.length() < 32) {
            throw new IllegalStateException(
                "FATAL: JWT_SECRET must be at least 32 characters (256 bits) for HS256. " +
                "Current length: " + jwtSecret.length()
            );
        }
        log.info("JWT secret validation: OK (length: {})", jwtSecret.length());
    }

    private void validateProductionConfig() {
        List<String> requiredProdVars = List.of(
            "DB_PASSWORD",
            "JWT_SECRET",
            "MP_ACCESS_TOKEN",
            "MP_WEBHOOK_SECRET"
        );

        List<String> missing = requiredProdVars.stream()
            .filter(var -> env.getProperty(var) == null || env.getProperty(var).isBlank())
            .toList();

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                "FATAL: Missing required environment variables for production: " + missing
            );
        }
        log.info("Production configuration validation: OK");
    }
}
