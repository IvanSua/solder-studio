package com.tiendaropa.config.properties;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed, validated configuration for file upload limits.
 * Bound from the {@code app.upload.*} namespace.
 */
@ConfigurationProperties(prefix = "app.upload")
@Validated
public record UploadProperties(

        @NotBlank(message = "Allowed MIME types must not be blank")
        String allowedTypes,

        @Min(value = 1, message = "Max file size must be at least 1 byte")
        long maxFileSizeBytes,

        @Min(value = 1, message = "Max files per design must be at least 1")
        int maxFilesPerDesign,

        @Min(value = 1, message = "Max total size must be at least 1 byte")
        long maxTotalSizeBytes,

        @Min(value = 1, message = "Min recommended resolution must be positive")
        int minResolutionRecommended,

        @Min(value = 1, message = "Min absolute resolution must be positive")
        int minResolutionAbsolute

) {}
