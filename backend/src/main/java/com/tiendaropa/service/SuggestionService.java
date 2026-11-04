package com.tiendaropa.service;

import com.tiendaropa.dto.response.SuggestionResponse;
import com.tiendaropa.entity.Suggestion;
import com.tiendaropa.entity.SuggestionVote;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.SuggestionRepository;
import com.tiendaropa.repository.SuggestionVoteRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SuggestionService {

    private final SuggestionRepository suggestionRepository;
    private final SuggestionVoteRepository voteRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<SuggestionResponse> list(Long currentUserId, Pageable pageable) {
        return suggestionRepository.findAllByOrderByVoteCountDescCreatedAtDesc(pageable)
                .map(s -> mapSuggestion(s, currentUserId));
    }

    @Transactional
    public SuggestionResponse create(Long userId, String title, String description) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (title == null || title.isBlank()) {
            throw new BusinessException("El título es requerido", HttpStatus.BAD_REQUEST);
        }

        Suggestion s = Suggestion.builder()
                .user(user)
                .title(title.trim())
                .description(description != null ? description.trim() : null)
                .build();

        return mapSuggestion(suggestionRepository.save(s), userId);
    }

    @Transactional
    public SuggestionResponse vote(Long suggestionId, Long userId) {
        Suggestion s = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ResourceNotFoundException("Suggestion not found: " + suggestionId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (voteRepository.existsBySuggestionIdAndUserId(suggestionId, userId)) {
            // Toggle off (unvote)
            voteRepository.findBySuggestionIdAndUserId(suggestionId, userId)
                    .ifPresent(voteRepository::delete);
            s.setVoteCount(Math.max(0, s.getVoteCount() - 1));
        } else {
            SuggestionVote vote = SuggestionVote.builder()
                    .suggestion(s)
                    .user(user)
                    .build();
            voteRepository.save(vote);
            s.setVoteCount(s.getVoteCount() + 1);
        }

        return mapSuggestion(suggestionRepository.save(s), userId);
    }

    // Admin: Get suggestions with pending answers
    @Transactional(readOnly = true)
    public List<SuggestionResponse> getPendingSuggestions() {
        return suggestionRepository.findByAnswerIsNullOrderByCreatedAtDesc().stream()
                .map(s -> mapSuggestion(s, null))
                .collect(Collectors.toList());
    }

    // Admin: Get suggestions with answers (limited)
    @Transactional(readOnly = true)
    public List<SuggestionResponse> getAnsweredSuggestions(int limit) {
        return suggestionRepository.findByAnswerIsNotNullOrderByAnsweredAtDesc().stream()
                .limit(limit)
                .map(s -> mapSuggestion(s, null))
                .collect(Collectors.toList());
    }

    // Admin: Get pending suggestions (pageable)
    @Transactional(readOnly = true)
    public Page<SuggestionResponse> getPendingSuggestionsPage(Pageable pageable) {
        return suggestionRepository.findByAnswerIsNullOrderByCreatedAtDesc(pageable)
                .map(s -> mapSuggestion(s, null));
    }

    // Admin: Get answered suggestions (pageable)
    @Transactional(readOnly = true)
    public Page<SuggestionResponse> getAnsweredSuggestionsPage(Pageable pageable) {
        return suggestionRepository.findByAnswerIsNotNullOrderByAnsweredAtDesc(pageable)
                .map(s -> mapSuggestion(s, null));
    }

    // Admin: Answer a suggestion
    @Transactional
    public SuggestionResponse answerSuggestion(Long suggestionId, Long adminUserId, String answer, String newStatus) {
        Suggestion s = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ResourceNotFoundException("Suggestion not found: " + suggestionId));
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        s.setAnswer(answer);
        s.setAnsweredBy(admin);
        s.setAnsweredAt(Instant.now());
        if (newStatus != null) {
            s.setStatus(newStatus);
        }

        return mapSuggestion(suggestionRepository.save(s), null);
    }

    private SuggestionResponse mapSuggestion(Suggestion s, Long currentUserId) {
        String authorName = s.getUser() != null
                ? s.getUser().getFirstName() + " " + s.getUser().getLastName().charAt(0) + "."
                : "Anónimo";
        String answeredByName = s.getAnsweredBy() != null
                ? s.getAnsweredBy().getFirstName() + " " + s.getAnsweredBy().getLastName().charAt(0) + "."
                : null;
        boolean hasVoted = currentUserId != null &&
                voteRepository.existsBySuggestionIdAndUserId(s.getId(), currentUserId);
        return SuggestionResponse.builder()
                .id(s.getId())
                .title(s.getTitle())
                .description(s.getDescription())
                .voteCount(s.getVoteCount())
                .status(s.getStatus())
                .authorName(authorName)
                .hasVoted(hasVoted)
                .createdAt(s.getCreatedAt())
                .answer(s.getAnswer())
                .answeredByName(answeredByName)
                .answeredAt(s.getAnsweredAt())
                .build();
    }
}
