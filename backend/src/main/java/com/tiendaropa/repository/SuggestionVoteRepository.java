package com.tiendaropa.repository;

import com.tiendaropa.entity.SuggestionVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.Set;

public interface SuggestionVoteRepository extends JpaRepository<SuggestionVote, Long> {

    boolean existsBySuggestionIdAndUserId(Long suggestionId, Long userId);

    Optional<SuggestionVote> findBySuggestionIdAndUserId(Long suggestionId, Long userId);

    /** Returns IDs of suggestions that the given user has voted on, for a given set of suggestion IDs */
    Set<Long> findSuggestionIdsByUserId(Long userId);
}
