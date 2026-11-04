package com.tiendaropa.repository;

import com.tiendaropa.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByActiveTrueOrderBySortOrderAsc();

    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.children WHERE c.parent IS NULL AND c.active = true ORDER BY c.sortOrder ASC")
    List<Category> findByParentIsNullAndActiveTrueOrderBySortOrderAsc();

    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.children WHERE c.id = :id")
    Optional<Category> findByIdWithChildren(@Param("id") Long id);

    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.children WHERE c.slug = :slug")
    Optional<Category> findBySlugWithChildren(@Param("slug") String slug);

    Optional<Category> findBySlug(String slug);
}
