package com.tiendaropa.controller;

import com.tiendaropa.dto.response.BlogPostResponse;
import com.tiendaropa.service.BlogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/blog")
@RequiredArgsConstructor
public class BlogController {

    private final BlogService blogService;

    @GetMapping
    public ResponseEntity<Page<BlogPostResponse>> getPublishedPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(blogService.getPublishedPosts(page, size));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<BlogPostResponse>> getFeaturedPosts() {
        return ResponseEntity.ok(blogService.getFeaturedPosts());
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<BlogPostResponse> getPostBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(blogService.getPostBySlug(slug));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<Page<BlogPostResponse>> getPostsByCategory(
            @PathVariable String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(blogService.getPostsByCategory(category, page, size));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getAllCategories() {
        return ResponseEntity.ok(blogService.getAllCategories());
    }
}
