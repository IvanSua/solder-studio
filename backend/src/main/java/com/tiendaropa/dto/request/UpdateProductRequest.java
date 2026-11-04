package com.tiendaropa.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProductRequest {

    @Size(max = 255)
    private String name;

    /** Optional — if provided, replaces the current slug */
    private String slug;

    private String description;

    private Long categoryId;

    private Boolean customizable;

    private Boolean active;
}
