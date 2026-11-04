package com.tiendaropa.service;

import com.tiendaropa.dto.request.BlogPostRequest;
import com.tiendaropa.dto.response.BlogPostResponse;
import com.tiendaropa.entity.BlogPost;
import com.tiendaropa.repository.BlogPostRepository;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.shared.util.FileTypeDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BlogService {

    private final BlogPostRepository blogPostRepository;
    private final StorageService storageService;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

    public Page<BlogPostResponse> getPublishedPosts(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return blogPostRepository.findByPublishedTrueOrderByPublishedAtDesc(pageable)
                .map(this::toResponse);
    }

    public List<BlogPostResponse> getFeaturedPosts() {
        return blogPostRepository.findByPublishedTrueAndFeaturedTrueOrderByPublishedAtDesc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public BlogPostResponse getPostBySlug(String slug) {
        BlogPost post = blogPostRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));
        if (!post.isPublished()) {
            throw new ResourceNotFoundException("Post not found");
        }
        return toResponse(post);
    }

    public Page<BlogPostResponse> getPostsByCategory(String category, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return blogPostRepository.findByPublishedTrueAndCategoryOrderByPublishedAtDesc(category, pageable)
                .map(this::toResponse);
    }

    public List<String> getAllCategories() {
        return blogPostRepository.findAllPublishedCategories();
    }

    // Admin methods
    public Page<BlogPostResponse> getAllPosts(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return blogPostRepository.findAll(pageable)
                .map(this::toResponse);
    }

    public BlogPostResponse getPostById(Long id) {
        BlogPost post = blogPostRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));
        return toResponse(post);
    }

    @Transactional
    public BlogPostResponse createPost(BlogPostRequest request) {
        String slug = generateSlug(request.getTitle());
        
        BlogPost post = BlogPost.builder()
                .title(request.getTitle())
                .slug(slug)
                .excerpt(request.getExcerpt())
                .content(request.getContent())
                .author(request.getAuthor())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .videoUrl(request.getVideoUrl())
                .published(request.isPublished())
                .featured(request.isFeatured())
                .publishedAt(request.isPublished() ? Instant.now() : null)
                .build();

        BlogPost saved = blogPostRepository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public BlogPostResponse updatePost(Long id, BlogPostRequest request) {
        BlogPost post = blogPostRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found"));

        post.setTitle(request.getTitle());
        post.setExcerpt(request.getExcerpt());
        post.setContent(request.getContent());
        post.setAuthor(request.getAuthor());
        post.setCategory(request.getCategory());
        post.setImageUrl(request.getImageUrl());
        post.setVideoUrl(request.getVideoUrl());
        post.setPublished(request.isPublished());
        post.setFeatured(request.isFeatured());

        // Set publishedAt if publishing for the first time
        if (request.isPublished() && post.getPublishedAt() == null) {
            post.setPublishedAt(Instant.now());
        }

        BlogPost saved = blogPostRepository.save(post);
        return toResponse(saved);
    }

    @Transactional
    public void deletePost(Long id) {
        if (!blogPostRepository.existsById(id)) {
            throw new ResourceNotFoundException("Post not found");
        }
        blogPostRepository.deleteById(id);
    }

    /** Upload an image to MinIO and return the object key (stored in imageUrl). */
    public String uploadImage(MultipartFile file) {
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new BusinessException("Image exceeds 10MB maximum", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        // Validate the real file type by magic bytes — never trust the client-supplied
        // Content-Type header or the filename extension for what gets stored/served back.
        try {
            byte[] fileBytes = file.getBytes();
            byte[] header = Arrays.copyOf(fileBytes, Math.min(fileBytes.length, 16));
            String detectedMimeType = FileTypeDetector.detectMimeType(header);
            if (detectedMimeType == null || !ALLOWED_IMAGE_TYPES.contains(detectedMimeType)) {
                throw new BusinessException("Only JPEG, PNG and WebP images are accepted", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            }
        } catch (IOException e) {
            throw new BusinessException("Failed to read uploaded file", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return storageService.upload(file, "blog");
    }

    /** Generate a presigned URL for a given MinIO key (for immediate preview). */
    public String getImagePreviewUrl(String key) {
        return storageService.getPresignedUrl(key);
    }

    /** Resolve imageUrl: if it's a MinIO key (no http prefix), generate a presigned URL. */
    private String resolveImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return null;
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
        try {
            return storageService.getPresignedUrl(imageUrl);
        } catch (Exception e) {
            log.warn("Failed to generate presigned URL for blog image: {}", imageUrl);
            return imageUrl;
        }
    }

    private String generateSlug(String title) {
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .trim();

        // Ensure uniqueness
        String finalSlug = slug;
        int counter = 1;
        while (blogPostRepository.existsBySlug(finalSlug)) {
            finalSlug = slug + "-" + counter++;
        }
        return finalSlug;
    }

    private BlogPostResponse toResponse(BlogPost post) {
        return BlogPostResponse.builder()
                .id(post.getId())
                .title(post.getTitle())
                .slug(post.getSlug())
                .excerpt(post.getExcerpt())
                .content(post.getContent())
                .author(post.getAuthor())
                .category(post.getCategory())
                .imageUrl(resolveImageUrl(post.getImageUrl()))
                .imageKey(post.getImageUrl())   // raw MinIO key (or null/direct URL)
                .videoUrl(post.getVideoUrl())
                .published(post.isPublished())
                .featured(post.isFeatured())
                .createdAt(post.getCreatedAt())
                .publishedAt(post.getPublishedAt())
                .build();
    }
}
