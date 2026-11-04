package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class SavedSizesRequest {

    private List<SizeEntry> sizes;

    @Data
    public static class SizeEntry {
        @NotBlank
        private String categoryName;
        @NotBlank
        private String size;
    }
}
