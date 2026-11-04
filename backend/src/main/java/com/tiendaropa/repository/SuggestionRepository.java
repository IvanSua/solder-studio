package com.tiendaropa.repository;

import com.tiendaropa.entity.Suggestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SuggestionRepository extends JpaRepository<Suggestion, Long> {

    Page<Suggestion> findAllByOrderByVoteCountDescCreatedAtDesc(Pageable pageable);

    Page<Suggestion> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<Suggestion> findByAnswerIsNullOrderByCreatedAtDesc();

    List<Suggestion> findByAnswerIsNotNullOrderByAnsweredAtDesc();

    Page<Suggestion> findByAnswerIsNullOrderByCreatedAtDesc(Pageable pageable);

    Page<Suggestion> findByAnswerIsNotNullOrderByAnsweredAtDesc(Pageable pageable);
}
