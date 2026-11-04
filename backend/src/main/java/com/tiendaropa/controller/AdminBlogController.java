package com.tiendaropa.controller;

import com.tiendaropa.dto.request.BlogPostRequest;
import com.tiendaropa.dto.response.BlogPostResponse;
import com.tiendaropa.service.BlogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/blog")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminBlogController {

    private final BlogService blogService;

    @GetMapping
    public ResponseEntity<Page<BlogPostResponse>> getAllPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(blogService.getAllPosts(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BlogPostResponse> getPost(@PathVariable Long id) {
        return ResponseEntity.ok(blogService.getPostById(id));
    }

    @PostMapping
    public ResponseEntity<BlogPostResponse> createPost(@Valid @RequestBody BlogPostRequest request) {
        return ResponseEntity.ok(blogService.createPost(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BlogPostResponse> updatePost(
            @PathVariable Long id,
            @Valid @RequestBody BlogPostRequest request) {
        return ResponseEntity.ok(blogService.updatePost(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id) {
        blogService.deletePost(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Upload an image for a blog post.
     * Returns the MinIO object key; the frontend must store this as imageUrl.
     */
    @PostMapping("/upload-image")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        String key = blogService.uploadImage(file);
        String previewUrl = blogService.getImagePreviewUrl(key);
        return ResponseEntity.ok(Map.of("key", key, "previewUrl", previewUrl));
    }

    /**
     * Publish a blog post to social media platforms.
     * Stub implementation — real integration requires configuring
     * INSTAGRAM_ACCESS_TOKEN / FACEBOOK_PAGE_ACCESS_TOKEN on the server.
     */
    @PostMapping("/{id}/publish-social")
    public ResponseEntity<Map<String, String>> publishToSocial(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> channels) {
        boolean instagram = Boolean.TRUE.equals(channels.get("instagram"));
        boolean facebook  = Boolean.TRUE.equals(channels.get("facebook"));
        log.info("Social publish requested for post {} — Instagram: {}, Facebook: {}", id, instagram, facebook);
        return ResponseEntity.ok(Map.of(
            "message",   "Solicitud de publicación social registrada",
            "instagram", instagram ? "pendiente" : "no solicitado",
            "facebook",  facebook  ? "pendiente" : "no solicitado"
        ));
    }
}
