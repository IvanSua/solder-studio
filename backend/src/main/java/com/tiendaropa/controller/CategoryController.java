package com.tiendaropa.controller;

import com.tiendaropa.entity.Category;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<CategoryResponse> listRoots() {
        return categoryRepository.findByParentIsNullAndActiveTrueOrderBySortOrderAsc()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public CategoryResponse getById(@PathVariable Long id) {
        Category category = categoryRepository.findByIdWithChildren(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        return mapToResponse(category);
    }

    @GetMapping("/slug/{slug}")
    @Transactional(readOnly = true)
    public CategoryResponse getBySlug(@PathVariable String slug) {
        Category category = categoryRepository.findBySlugWithChildren(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + slug));
        return mapToResponse(category);
    }

    private CategoryResponse mapToResponse(Category category) {
        List<CategoryResponse> children = List.of();
        if (category.getChildren() != null && !category.getChildren().isEmpty()) {
            children = category.getChildren().stream()
                    .filter(Category::isActive)
                    .map(child -> new CategoryResponse(
                            child.getId(),
                            child.getName(),
                            child.getSlug(),
                            child.getDescription(),
                            child.getImageUrl(),
                            List.of()
                    ))
                    .toList();
        }

        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                category.getImageUrl(),
                children
        );
    }

    public record CategoryResponse(
            Long id,
            String name,
            String slug,
            String description,
            String imageUrl,
            List<CategoryResponse> children
    ) {}
}
