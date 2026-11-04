package com.tiendaropa.repository;

import com.tiendaropa.entity.ProductQuestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductQuestionRepository extends JpaRepository<ProductQuestion, Long> {

    Page<ProductQuestion> findByProductIdOrderByCreatedAtDesc(Long productId, Pageable pageable);
    
    List<ProductQuestion> findByAnswerIsNullOrderByCreatedAtDesc();
    
    List<ProductQuestion> findByAnswerIsNotNullOrderByAnsweredAtDesc();
}
