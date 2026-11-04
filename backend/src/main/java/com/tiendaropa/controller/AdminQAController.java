package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ProductQuestionsResponse;
import com.tiendaropa.dto.response.QuestionResponse;
import com.tiendaropa.service.ProductQAService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/questions")
@RequiredArgsConstructor
public class AdminQAController {

    private final ProductQAService qaService;

    /** Get products with pending questions */
    @GetMapping("/pending")
    public List<ProductQuestionsResponse> getPendingProducts() {
        return qaService.getProductsWithPendingQuestions();
    }

    /** Get products with answered questions (limited) */
    @GetMapping("/answered")
    public List<ProductQuestionsResponse> getAnsweredProducts(
            @RequestParam(defaultValue = "5") int limit) {
        return qaService.getProductsWithAnsweredQuestions(limit);
    }

    /** Get questions for a specific product */
    @GetMapping("/product/{productId}")
    public Page<QuestionResponse> getQuestionsByProduct(
            @PathVariable Long productId,
            Pageable pageable) {
        return qaService.getQuestionsByProduct(productId, pageable);
    }

    /** Admin answers a question */
    @PatchMapping("/{id}/answer")
    public QuestionResponse answer(@PathVariable Long id,
                                   @RequestBody Map<String, String> body,
                                   Authentication auth) {
        String answer = body.get("answer");
        if (answer == null || answer.isBlank()) {
            throw new com.tiendaropa.exception.BusinessException(
                    "La respuesta no puede estar vacía",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        return qaService.answerQuestion(id, (Long) auth.getPrincipal(), answer.trim());
    }
}
