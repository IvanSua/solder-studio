package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SizeGuideRequest {

    @NotNull(message = "Category ID es requerido")
    private Long categoryId;

    @NotBlank(message = "Nombre es requerido")
    private String name;

    @NotNull(message = "Talles es requerido")
    private List<String> sizes;

    @NotNull(message = "Medidas es requerido")
    private Map<String, Map<String, String>> measurements;

    private String instructions;

    private Boolean active;
}
