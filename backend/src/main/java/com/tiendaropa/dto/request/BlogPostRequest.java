package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BlogPostRequest {

    @NotBlank(message = "El título es requerido")
    private String title;

    @NotBlank(message = "El contenido es requerido")
    private String content;

    private String excerpt;

    @NotBlank(message = "El autor es requerido")
    private String author;

    @NotBlank(message = "La categoría es requerida")
    private String category;

    private String imageUrl;

    private String videoUrl;

    private boolean published;

    private boolean featured;
}
