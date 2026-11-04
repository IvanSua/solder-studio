package com.tiendaropa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * RedisRepositoriesAutoConfiguration is excluded because this app doesn't use
 * Spring Data Redis repositories (no @RedisHash entities) — Redis is only used
 * directly via RedisTemplate/RedisCacheManager (see RedisConfig). Without this
 * exclusion, Spring Data's repository scanner has to inspect every JPA repository
 * interface to rule out whether it's a Redis repository too, logging a "could not
 * safely identify store assignment" warning for each one — harmless, but ~30 lines
 * of noise on every startup for a feature that's never actually used.
 */
@SpringBootApplication(exclude = RedisRepositoriesAutoConfiguration.class)
@ConfigurationPropertiesScan("com.tiendaropa.config.properties")
@EnableCaching
@EnableScheduling
@EnableAsync
public class TiendaDeRopaApplication {

    public static void main(String[] args) {
        SpringApplication.run(TiendaDeRopaApplication.class, args);
    }
}
