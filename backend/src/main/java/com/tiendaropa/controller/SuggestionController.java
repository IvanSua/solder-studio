package com.tiendaropa.controller;

import com.tiendaropa.dto.response.SuggestionResponse;
import com.tiendaropa.service.SuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/suggestions")
@RequiredArgsConstructor
public class SuggestionController {

    private final SuggestionService suggestionService;

    @GetMapping
    public Page<SuggestionResponse> list(Authentication auth, Pageable pageable) {
        Long userId = auth != null ? (Long) auth.getPrincipal() : null;
        return suggestionService.list(userId, pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SuggestionResponse create(@RequestBody Map<String, String> body,
                                     Authentication auth) {
        String title       = body.get("title");
        String description = body.get("description");
        return suggestionService.create((Long) auth.getPrincipal(), title, description);
    }

    @PostMapping("/{id}/vote")
    public SuggestionResponse vote(@PathVariable Long id, Authentication auth) {
        return suggestionService.vote(id, (Long) auth.getPrincipal());
    }

    // ========== ADMIN ENDPOINTS ==========

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN') or hasRole('WORKER')")
    public List<SuggestionResponse> getPendingSuggestions() {
        return suggestionService.getPendingSuggestions();
    }

    @GetMapping("/admin/answered")
    @PreAuthorize("hasRole('ADMIN') or hasRole('WORKER')")
    public List<SuggestionResponse> getAnsweredSuggestions(
            @RequestParam(defaultValue = "10") int limit) {
        return suggestionService.getAnsweredSuggestions(limit);
    }

    @GetMapping("/admin/pending/page")
    @PreAuthorize("hasRole('ADMIN') or hasRole('WORKER')")
    public Page<SuggestionResponse> getPendingSuggestionsPage(Pageable pageable) {
        return suggestionService.getPendingSuggestionsPage(pageable);
    }

    @GetMapping("/admin/answered/page")
    @PreAuthorize("hasRole('ADMIN') or hasRole('WORKER')")
    public Page<SuggestionResponse> getAnsweredSuggestionsPage(Pageable pageable) {
        return suggestionService.getAnsweredSuggestionsPage(pageable);
    }

    @PatchMapping("/admin/{id}/answer")
    @PreAuthorize("hasRole('ADMIN') or hasRole('WORKER')")
    public SuggestionResponse answer(@PathVariable Long id,
                                     @RequestBody Map<String, String> body,
                                     Authentication auth) {
        String answer = body.get("answer");
        if (answer == null || answer.isBlank()) {
            throw new com.tiendaropa.exception.BusinessException(
                    "La respuesta no puede estar vacía",
                    HttpStatus.BAD_REQUEST);
        }
        String newStatus = body.get("status");
        return suggestionService.answerSuggestion(id, (Long) auth.getPrincipal(), answer.trim(), newStatus);
    }
}
