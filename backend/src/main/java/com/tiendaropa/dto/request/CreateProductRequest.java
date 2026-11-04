package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateProductRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    /** Optional — auto-generated from name if blank */
    private String slug;

    private String description;

    private Long categoryId;

    private boolean customizable = false;

    private boolean active = true;
}
