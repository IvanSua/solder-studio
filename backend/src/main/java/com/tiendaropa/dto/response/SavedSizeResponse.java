package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class SavedSizeResponse {
    private String categoryName;
    private String size;
}
