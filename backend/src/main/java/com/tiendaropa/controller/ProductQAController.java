package com.tiendaropa.controller;

import com.tiendaropa.dto.response.QuestionResponse;
import com.tiendaropa.service.ProductQAService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/products/{slug}/questions")
@RequiredArgsConstructor
public class ProductQAController {

    private final ProductQAService qaService;

    @GetMapping
    public Page<QuestionResponse> list(@PathVariable String slug, Pageable pageable) {
        return qaService.getQuestions(slug, pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionResponse ask(@PathVariable String slug,
                                @RequestBody Map<String, String> body,
                                Authentication auth) {
        String question = body.get("question");
        if (question == null || question.isBlank()) {
            throw new com.tiendaropa.exception.BusinessException(
                    "La pregunta no puede estar vacía",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        return qaService.askQuestion(slug, (Long) auth.getPrincipal(), question.trim());
    }
}
