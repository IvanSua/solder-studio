package com.tiendaropa.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder @AllArgsConstructor
public class SuggestionResponse {
    private Long id;
    private String title;
    private String description;
    private Integer voteCount;
    private String status;
    private String authorName;
    private Boolean hasVoted;
    private Instant createdAt;
    // Admin fields
    private String answer;
    private String answeredByName;
    private Instant answeredAt;
}
