package com.tiendaropa.config;

import com.tiendaropa.config.properties.StorageProperties;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")
@RequiredArgsConstructor
@Slf4j
public class StorageConfig {

    private final StorageProperties storageProperties;

    @Bean
    public MinioClient minioClient() {
        MinioClient client = MinioClient.builder()
                .endpoint(storageProperties.endpoint())
                .credentials(storageProperties.accessKey(), storageProperties.secretKey())
                .build();

        try {
            boolean exists = client.bucketExists(
                    BucketExistsArgs.builder().bucket(storageProperties.bucketName()).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(storageProperties.bucketName()).build());
                log.info("Created storage bucket: {}", storageProperties.bucketName());
            }
        } catch (Exception e) {
            log.warn("Could not verify/create storage bucket: {}", e.getMessage());
        }

        return client;
    }
}