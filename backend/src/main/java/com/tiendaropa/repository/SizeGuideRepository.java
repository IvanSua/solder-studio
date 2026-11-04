package com.tiendaropa.repository;

import com.tiendaropa.entity.SizeGuide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SizeGuideRepository extends JpaRepository<SizeGuide, Long> {

    List<SizeGuide> findByCategoryIdAndActiveTrue(Long categoryId);

    Optional<SizeGuide> findByCategoryIdAndActiveTrueAndId(Long categoryId, Long id);

    @Query("SELECT sg FROM SizeGuide sg WHERE sg.category.id = :categoryId AND sg.active = true ORDER BY sg.createdAt DESC")
    List<SizeGuide> findActiveByCategory(Long categoryId);

    List<SizeGuide> findByActiveTrueOrderByCategoryName();
}
