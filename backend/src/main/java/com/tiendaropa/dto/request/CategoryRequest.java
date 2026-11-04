package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CategoryRequest {

    @NotBlank(message = "El nombre es requerido")
    @Size(max = 100)
    private String name;

    @NotBlank(message = "El slug es requerido")
    @Size(max = 120)
    private String slug;

    @Size(max = 500)
    private String description;

    private String imageUrl;

    private Long parentId;

    private Integer sortOrder;

    private boolean active = true;
}
