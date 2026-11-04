package com.tiendaropa.controller;

import com.tiendaropa.dto.request.SizeGuideRequest;
import com.tiendaropa.dto.response.SizeGuideResponse;
import com.tiendaropa.service.SizeGuideService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/size-guides")
@RequiredArgsConstructor
public class SizeGuideController {

    private final SizeGuideService sizeGuideService;

    // Public endpoints

    @GetMapping("/category/{categoryId}")
    public List<SizeGuideResponse> getByCategory(@PathVariable Long categoryId) {
        return sizeGuideService.getByCategory(categoryId);
    }

    @GetMapping
    public List<SizeGuideResponse> getAll() {
        return sizeGuideService.getAllActive();
    }

    @GetMapping("/{id}")
    public SizeGuideResponse getById(@PathVariable Long id) {
        return sizeGuideService.getById(id);
    }

    // Admin endpoints

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public SizeGuideResponse create(@Valid @RequestBody SizeGuideRequest request) {
        return sizeGuideService.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public SizeGuideResponse update(@PathVariable Long id, @Valid @RequestBody SizeGuideRequest request) {
        return sizeGuideService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        sizeGuideService.delete(id);
    }
}
