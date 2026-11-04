package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for MinIO / S3-compatible object storage.
 * Bound from the {@code app.storage.*} namespace.
 */
@ConfigurationProperties(prefix = "app.storage")
@Validated
public record StorageProperties(

        @NotBlank(message = "Storage endpoint must not be blank")
        String endpoint,

        @NotBlank(message = "Storage access key must not be blank")
        String accessKey,

        @NotBlank(message = "Storage secret key must not be blank")
        String secretKey,

        @NotBlank(message = "Storage bucket name must not be blank")
        String bucketName,

        @Min(value = 1, message = "Presigned URL expiry must be at least 1 minute")
        long presignedUrlExpiryMinutes

) {}
