package com.tiendaropa.service;

import com.tiendaropa.config.properties.StorageProperties;
import com.tiendaropa.exception.BusinessException;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.http.HttpStatus;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class StorageService {

    private final MinioClient minioClient;
    private final StorageProperties storageProperties;

    public String upload(MultipartFile file, String folder) {
        String objectName = folder + "/" + UUID.randomUUID() + getExtension(file.getOriginalFilename());

        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());

            return objectName;
        } catch (Exception e) {
            throw new BusinessException("Failed to upload file", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String upload(InputStream inputStream, long size, String contentType, String folder, String extension) {
        String objectName = folder + "/" + UUID.randomUUID() + extension;

        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .stream(inputStream, size, -1)
                    .contentType(contentType)
                    .build());

            return objectName;
        } catch (Exception e) {
            throw new BusinessException("Failed to upload file", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String getPresignedUrl(String objectName) {
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .method(Method.GET)
                    .expiry((int) storageProperties.presignedUrlExpiryMinutes(), TimeUnit.MINUTES)
                    .build());
        } catch (Exception e) {
            throw new BusinessException("Failed to generate presigned URL", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String uploadBytes(byte[] bytes, String objectName, String contentType) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                    .contentType(contentType)
                    .build());
            return objectName;
        } catch (Exception e) {
            throw new BusinessException("Failed to upload bytes to storage: " + objectName, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public byte[] downloadBytes(String objectName) {
        try {
            InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .build());
            return stream.readAllBytes();
        } catch (Exception e) {
            throw new BusinessException("Failed to download from storage: " + objectName, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public void delete(String objectName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(storageProperties.bucketName())
                    .object(objectName)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to delete object: {}", objectName, e);
        }
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
