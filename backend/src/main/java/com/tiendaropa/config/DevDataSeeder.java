package com.tiendaropa.config;

import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserLevel;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds test users on first startup (dev/QA only).
 * Idempotent — does nothing if the users already exist.
 *
 * Users are only created when DEV_SEED_PASSWORD is set; both accounts use that value:
 *   admin@tiendaropa.com  (ADMIN)
 *   user@tiendaropa.com   (CUSTOMER)
 *
 * @Profile("!prod") — this must never run against a production database. It has
 * no guard against overwriting real accounts and creates an ADMIN user. Excluded
 * specifically (rather than opt-in to "dev"/"test") so it still runs with no active
 * profile set (SPRING_PROFILES_ACTIVE unset), which is what plain local
 * `./mvnw spring-boot:run` uses.
 */
@Component
@Profile("!prod")
@RequiredArgsConstructor
@Slf4j
public class DevDataSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${DEV_SEED_PASSWORD:}")
    private String seedPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (seedPassword == null || seedPassword.isBlank()) {
            log.info("Dev seed skipped: DEV_SEED_PASSWORD is not set");
            return;
        }
        seedUser("admin@tiendaropa.com", seedPassword, "Admin", "Tienda", UserRole.ADMIN);
        seedUser("user@tiendaropa.com",  seedPassword, "Cliente", "Demo",  UserRole.CUSTOMER);
    }

    private void seedUser(String email, String password, String firstName, String lastName, UserRole role) {
        if (userRepository.findByEmail(email).isPresent()) return;

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .firstName(firstName)
                .lastName(lastName)
                .role(role)
                .enabled(true)
                .emailVerified(true)
                .points(0)
                .level(UserLevel.BRONZE)
                .failedLoginAttempts(0)
                .build();

        userRepository.save(user);
        log.info("Dev seed: created {} user → {}", role, email);
    }
}
