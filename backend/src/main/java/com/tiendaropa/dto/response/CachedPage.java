package com.tiendaropa.dto.response;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.io.Serializable;
import java.util.List;

/**
 * Serializable stand-in for {@link org.springframework.data.domain.PageImpl}.
 *
 * <p>Spring's {@code PageImpl} has no no-arg constructor, so Jackson cannot
 * deserialize it back from Redis — a value written to the cache is never read
 * back, silently degrading every {@code @Cacheable} attempt into a permanent
 * cache miss. This record carries only the fields needed to reconstruct a
 * {@code PageImpl} on the caller's side once it comes back out of Redis (or
 * out of an in-memory cache), and — being a plain record — round-trips through
 * {@code GenericJackson2JsonRedisSerializer} without issue.
 *
 * <p>Usage pattern: the {@code @Cacheable} method returns {@code CachedPage<T>};
 * the public-facing method calls it and wraps the result back into a
 * {@code Page<T>} via {@link #toPage(Pageable)}.
 */
public record CachedPage<T>(
        List<T> content,
        long totalElements,
        int pageNumber,
        int pageSize
) implements Serializable {

    public static <T> CachedPage<T> from(Page<T> page) {
        return new CachedPage<>(page.getContent(), page.getTotalElements(), page.getNumber(), page.getSize());
    }

    public Page<T> toPage(Pageable pageable) {
        return new PageImpl<>(content, pageable, totalElements);
    }
}
