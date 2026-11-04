package com.tiendaropa.config;

import com.tiendaropa.config.properties.AuthProperties;
import io.minio.MinioClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import static org.mockito.Mockito.mock;

@Configuration
@Profile("test")
@EnableConfigurationProperties(AuthProperties.class)
public class TestConfig {

    @Bean
    public MinioClient minioClient() {
        return mock(MinioClient.class);
    }
}
