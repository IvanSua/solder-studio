package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SizeGuideResponse {
    private Long id;
    private Long categoryId;
    private String categoryName;
    private String name;
    private List<String> sizes;
    private Map<String, Map<String, String>> measurements;
    private String instructions;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}
