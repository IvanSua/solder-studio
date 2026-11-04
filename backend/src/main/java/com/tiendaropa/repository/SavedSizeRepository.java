package com.tiendaropa.repository;

import com.tiendaropa.entity.SavedSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedSizeRepository extends JpaRepository<SavedSize, Long> {
    List<SavedSize> findByUserIdOrderByCategoryName(Long userId);
    Optional<SavedSize> findByUserIdAndCategoryName(Long userId, String categoryName);
    void deleteByUserIdAndCategoryName(Long userId, String categoryName);
}
