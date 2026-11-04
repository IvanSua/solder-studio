package com.tiendaropa.repository;

import com.tiendaropa.entity.BlogPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {

    Optional<BlogPost> findBySlug(String slug);

    Page<BlogPost> findByPublishedTrueOrderByPublishedAtDesc(Pageable pageable);

    List<BlogPost> findByPublishedTrueAndFeaturedTrueOrderByPublishedAtDesc();

    Page<BlogPost> findByPublishedTrueAndCategoryOrderByPublishedAtDesc(String category, Pageable pageable);

    @Query("SELECT DISTINCT b.category FROM BlogPost b WHERE b.published = true ORDER BY b.category")
    List<String> findAllPublishedCategories();

    boolean existsBySlug(String slug);
}
