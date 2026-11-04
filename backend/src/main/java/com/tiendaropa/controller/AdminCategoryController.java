package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CategoryRequest;
import com.tiendaropa.entity.Category;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/categories")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','WORKER')")
public class AdminCategoryController {

    private final CategoryRepository categoryRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<CategorySummary> listAll() {
        return categoryRepository.findAll().stream()
                .map(this::toSummary)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public CategorySummary create(@Valid @RequestBody CategoryRequest request) {
        Category category = buildCategory(request, new Category());
        return toSummary(categoryRepository.save(category));
    }

    @PutMapping("/{id}")
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public CategorySummary update(@PathVariable Long id,
                                  @Valid @RequestBody CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        buildCategory(request, category);
        return toSummary(categoryRepository.save(category));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public void deactivate(@PathVariable Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        category.setActive(false);
        categoryRepository.save(category);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Category buildCategory(CategoryRequest req, Category category) {
        category.setName(req.getName());
        category.setSlug(req.getSlug());
        category.setDescription(req.getDescription());
        category.setImageUrl(req.getImageUrl());
        category.setSortOrder(req.getSortOrder());
        category.setActive(req.isActive());

        if (req.getParentId() != null) {
            Category parent = categoryRepository.findById(req.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent category not found"));
            category.setParent(parent);
        } else {
            category.setParent(null);
        }

        return category;
    }

    private CategorySummary toSummary(Category c) {
        return new CategorySummary(
                c.getId(),
                c.getName(),
                c.getSlug(),
                c.getDescription(),
                c.getImageUrl(),
                c.getParent() != null ? c.getParent().getId() : null,
                c.getParent() != null ? c.getParent().getName() : null,
                c.getSortOrder(),
                c.isActive()
        );
    }

    public record CategorySummary(
            Long id,
            String name,
            String slug,
            String description,
            String imageUrl,
            Long parentId,
            String parentName,
            Integer sortOrder,
            boolean active
    ) {}
}
