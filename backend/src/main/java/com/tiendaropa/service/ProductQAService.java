package com.tiendaropa.service;

import com.tiendaropa.dto.response.ProductQuestionsResponse;
import com.tiendaropa.dto.response.QuestionResponse;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductQuestion;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ProductQuestionRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductQAService {

    private final ProductQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<QuestionResponse> getQuestions(String productSlug, Pageable pageable) {
        Product product = productRepository.findBySlug(productSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productSlug));
        return questionRepository.findByProductIdOrderByCreatedAtDesc(product.getId(), pageable)
                .map(this::mapQuestion);
    }

    /** Get ALL questions for admin panel */
    @Transactional(readOnly = true)
    public Page<QuestionResponse> getAllQuestions(Pageable pageable) {
        return questionRepository.findAll(pageable)
                .map(this::mapQuestion);
    }

    @Transactional
    public QuestionResponse askQuestion(String productSlug, Long userId, String questionText) {
        Product product = productRepository.findBySlug(productSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productSlug));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        ProductQuestion q = ProductQuestion.builder()
                .product(product)
                .user(user)
                .question(questionText)
                .build();

        return mapQuestion(questionRepository.save(q));
    }

    @Transactional
    public QuestionResponse answerQuestion(Long questionId, Long adminUserId, String answer) {
        ProductQuestion q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        q.setAnswer(answer);
        q.setAnsweredBy(admin);
        q.setAnsweredAt(Instant.now());

        return mapQuestion(questionRepository.save(q));
    }

    /** Get products with pending questions */
    @Transactional(readOnly = true)
    public List<ProductQuestionsResponse> getProductsWithPendingQuestions() {
        List<ProductQuestion> pendingQuestions = questionRepository.findByAnswerIsNullOrderByCreatedAtDesc();
        
        return pendingQuestions.stream()
                .collect(Collectors.groupingBy(q -> q.getProduct().getId()))
                .entrySet().stream()
                .map(entry -> {
                    Product product = entry.getValue().get(0).getProduct();
                    List<ProductQuestion> questions = entry.getValue();
                    return mapProductQuestions(product, questions);
                })
                .collect(Collectors.toList());
    }

    /** Get products with answered questions (limited) */
    @Transactional(readOnly = true)
    public List<ProductQuestionsResponse> getProductsWithAnsweredQuestions(int limit) {
        List<ProductQuestion> answeredQuestions = questionRepository.findByAnswerIsNotNullOrderByAnsweredAtDesc();
        
        // Group by product and limit
        Map<Long, List<ProductQuestion>> grouped = answeredQuestions.stream()
                .collect(Collectors.groupingBy(q -> q.getProduct().getId()));
        
        return grouped.entrySet().stream()
                .map(entry -> {
                    Product product = entry.getValue().get(0).getProduct();
                    List<ProductQuestion> questions = entry.getValue();
                    return mapProductQuestions(product, questions);
                })
                .limit(limit)
                .collect(Collectors.toList());
    }

    /** Get questions for a specific product */
    @Transactional(readOnly = true)
    public Page<QuestionResponse> getQuestionsByProduct(Long productId, Pageable pageable) {
        return questionRepository.findByProductIdOrderByCreatedAtDesc(productId, pageable)
                .map(this::mapQuestion);
    }

    private ProductQuestionsResponse mapProductQuestions(Product product, List<ProductQuestion> questions) {
        int pending = (int) questions.stream().filter(q -> q.getAnswer() == null).count();
        int answered = questions.size() - pending;
        
        String imageUrl = null;
        if (product.getImages() != null && !product.getImages().isEmpty()) {
            imageUrl = product.getImages().get(0).getImageUrl();
        }
        
        return ProductQuestionsResponse.builder()
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .productImageUrl(imageUrl)
                .totalQuestions(questions.size())
                .pendingQuestions(pending)
                .answeredQuestions(answered)
                .build();
    }

    private QuestionResponse mapQuestion(ProductQuestion q) {
        String authorName = q.getUser() != null
                ? q.getUser().getFirstName() + " " + q.getUser().getLastName().charAt(0) + "."
                : "Anónimo";
        String answeredByName = q.getAnsweredBy() != null
                ? q.getAnsweredBy().getFirstName() + " " + q.getAnsweredBy().getLastName().charAt(0) + "."
                : null;
        
        String imageUrl = null;
        if (q.getProduct() != null && q.getProduct().getImages() != null && !q.getProduct().getImages().isEmpty()) {
            imageUrl = q.getProduct().getImages().get(0).getImageUrl();
        }
        
        return QuestionResponse.builder()
                .id(q.getId())
                .question(q.getQuestion())
                .answer(q.getAnswer())
                .authorName(authorName)
                .answeredByName(answeredByName)
                .createdAt(q.getCreatedAt())
                .answeredAt(q.getAnsweredAt())
                .productId(q.getProduct() != null ? q.getProduct().getId() : null)
                .productName(q.getProduct() != null ? q.getProduct().getName() : null)
                .productSlug(q.getProduct() != null ? q.getProduct().getSlug() : null)
                .productImageUrl(imageUrl)
                .build();
    }
}
