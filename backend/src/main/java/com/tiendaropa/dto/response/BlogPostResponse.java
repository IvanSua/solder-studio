package com.tiendaropa.dto.response;

import lombok.*;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BlogPostResponse {

    private Long id;
    private String title;
    private String slug;
    private String excerpt;
    private String content;
    private String author;
    private String category;
    private String imageUrl;    // presigned URL for display
    private String imageKey;    // raw MinIO object key for persistence
    private String videoUrl;
    private boolean published;
    private boolean featured;
    private Instant createdAt;
    private Instant publishedAt;
}
