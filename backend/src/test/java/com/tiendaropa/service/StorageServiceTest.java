package com.tiendaropa.service;

import com.tiendaropa.config.properties.StorageProperties;
import io.minio.*;
import io.minio.http.Method;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StorageServiceTest {

    @Mock MinioClient minioClient;
    @Mock StorageProperties storageProperties;

    @InjectMocks StorageService storageService;

    @BeforeEach
    void setUp() {
        lenient().when(storageProperties.bucketName()).thenReturn("tienda-bucket");
        lenient().when(storageProperties.presignedUrlExpiryMinutes()).thenReturn(60L);
    }

    // ── upload(MultipartFile) ─────────────────────────────────────────────────

    @Nested
    class UploadMultipart {

        @Test
        void returnsObjectNameWithFolderPrefix() throws Exception {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "imagen.jpg", "image/jpeg", new byte[]{1, 2, 3});

            when(minioClient.putObject(any(PutObjectArgs.class))).thenReturn(null);

            String result = storageService.upload(file, "products");

            assertThat(result).startsWith("products/");
            assertThat(result).endsWith(".jpg");
        }

        @Test
        void wrapsMinioExceptionInRuntimeException() throws Exception {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "imagen.jpg", "image/jpeg", new byte[]{1});

            when(minioClient.putObject(any(PutObjectArgs.class))).thenThrow(new RuntimeException("minio down"));

            assertThatThrownBy(() -> storageService.upload(file, "products"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Failed to upload file");
        }

        @Test
        void handlesNullOriginalFilenameWithNoExtension() throws Exception {
            MockMultipartFile file = new MockMultipartFile("file", (String) null, "image/jpeg", new byte[]{1});

            when(minioClient.putObject(any(PutObjectArgs.class))).thenReturn(null);

            String result = storageService.upload(file, "designs");

            // No dot extension appended — just the UUID
            assertThat(result).startsWith("designs/");
            assertThat(result).doesNotContain("null");
        }
    }

    // ── upload(InputStream) ───────────────────────────────────────────────────

    @Nested
    class UploadInputStream {

        @Test
        void returnsObjectNameWithExtension() throws Exception {
            InputStream stream = new ByteArrayInputStream(new byte[]{1, 2, 3});

            when(minioClient.putObject(any(PutObjectArgs.class))).thenReturn(null);

            String result = storageService.upload(stream, 3L, "image/png", "avatars", ".png");

            assertThat(result).startsWith("avatars/");
            assertThat(result).endsWith(".png");
        }

        @Test
        void passesCorrectBucketAndContentType() throws Exception {
            InputStream stream = new ByteArrayInputStream(new byte[]{5});

            when(minioClient.putObject(any(PutObjectArgs.class))).thenReturn(null);

            storageService.upload(stream, 1L, "application/pdf", "docs", ".pdf");

            ArgumentCaptor<PutObjectArgs> captor = ArgumentCaptor.forClass(PutObjectArgs.class);
            verify(minioClient).putObject(captor.capture());
            assertThat(captor.getValue().bucket()).isEqualTo("tienda-bucket");
            assertThat(captor.getValue().contentType()).isEqualTo("application/pdf");
        }
    }

    // ── uploadBytes ───────────────────────────────────────────────────────────

    @Nested
    class UploadBytes {

        @Test
        void returnsObjectName() throws Exception {
            when(minioClient.putObject(any(PutObjectArgs.class))).thenReturn(null);

            String result = storageService.uploadBytes(new byte[]{10, 20}, "designs/preview.png", "image/png");

            assertThat(result).isEqualTo("designs/preview.png");
        }

        @Test
        void wrapsExceptionWithObjectNameInMessage() throws Exception {
            when(minioClient.putObject(any(PutObjectArgs.class))).thenThrow(new RuntimeException("err"));

            assertThatThrownBy(() -> storageService.uploadBytes(new byte[]{1}, "my/object.png", "image/png"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("my/object.png");
        }
    }

    // ── downloadBytes ─────────────────────────────────────────────────────────

    @Nested
    class DownloadBytes {

        @Test
        void returnsStreamContent() throws Exception {
            byte[] content = {1, 2, 3, 4};
            GetObjectResponse mockResponse = mock(GetObjectResponse.class);
            when(mockResponse.readAllBytes()).thenReturn(content);
            when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(mockResponse);

            byte[] result = storageService.downloadBytes("designs/file.png");

            assertThat(result).containsExactly(content);
        }

        @Test
        void wrapsExceptionOnDownloadFailure() throws Exception {
            when(minioClient.getObject(any(GetObjectArgs.class))).thenThrow(new RuntimeException("not found"));

            assertThatThrownBy(() -> storageService.downloadBytes("missing.png"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Failed to download");
        }
    }

    // ── getPresignedUrl ───────────────────────────────────────────────────────

    @Nested
    class GetPresignedUrl {

        @Test
        void returnsUrlFromMinio() throws Exception {
            when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                    .thenReturn("https://minio.example.com/bucket/obj?sig=abc");

            String url = storageService.getPresignedUrl("products/img.jpg");

            assertThat(url).isEqualTo("https://minio.example.com/bucket/obj?sig=abc");
        }

        @Test
        void usesGetMethod() throws Exception {
            when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                    .thenReturn("https://minio.example.com/url");

            storageService.getPresignedUrl("products/img.jpg");

            ArgumentCaptor<GetPresignedObjectUrlArgs> captor =
                    ArgumentCaptor.forClass(GetPresignedObjectUrlArgs.class);
            verify(minioClient).getPresignedObjectUrl(captor.capture());
            assertThat(captor.getValue().method()).isEqualTo(Method.GET);
        }

        @Test
        void wrapsExceptionOnUrlFailure() throws Exception {
            when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                    .thenThrow(new RuntimeException("presign failed"));

            assertThatThrownBy(() -> storageService.getPresignedUrl("bad/path"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Failed to generate presigned URL");
        }
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Nested
    class Delete {

        @Test
        void callsRemoveObjectOnMinio() throws Exception {
            storageService.delete("products/old.jpg");

            verify(minioClient).removeObject(any(RemoveObjectArgs.class));
        }

        @Test
        void doesNotThrowWhenMinioFails() throws Exception {
            doThrow(new RuntimeException("delete failed")).when(minioClient)
                    .removeObject(any(RemoveObjectArgs.class));

            // delete() logs warn — must NOT rethrow
            assertThatCode(() -> storageService.delete("products/gone.jpg"))
                    .doesNotThrowAnyException();
        }
    }
}
