package com.tiendaropa.service;

import com.tiendaropa.dto.response.QuestionResponse;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductQuestion;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ProductQuestionRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductQAServiceTest {

    @Mock ProductQuestionRepository questionRepository;
    @Mock ProductRepository         productRepository;
    @Mock UserRepository            userRepository;

    @InjectMocks ProductQAService productQAService;

    private Product product;
    private User    user;

    @BeforeEach
    void setUp() {
        product = Product.builder().id(1L).name("Remera").slug("remera").build();
        user    = User.builder().id(10L).email("u@test.com")
                .firstName("Test").lastName("User")
                .role(UserRole.CUSTOMER).enabled(true).build();
    }

    // ── askQuestion ───────────────────────────────────────────────────────────

    @Nested
    class AskQuestion {

        @Test
        void throwsWhenProductNotFound() {
            when(productRepository.findBySlug("ghost-product")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> productQAService.askQuestion("ghost-product", 10L, "¿Es elástica?"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("ghost-product");
        }

        @Test
        void throwsWhenUserNotFound() {
            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> productQAService.askQuestion("remera", 99L, "¿Tiene talle grande?"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void savesQuestionWithCorrectData() {
            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(userRepository.findById(10L)).thenReturn(Optional.of(user));

            ProductQuestion saved = ProductQuestion.builder()
                    .id(1L).product(product).user(user)
                    .question("¿Es transpirable?")
                    .build();
            when(questionRepository.save(any())).thenReturn(saved);

            productQAService.askQuestion("remera", 10L, "¿Es transpirable?");

            ArgumentCaptor<ProductQuestion> captor = ArgumentCaptor.forClass(ProductQuestion.class);
            verify(questionRepository).save(captor.capture());
            assertThat(captor.getValue().getQuestion()).isEqualTo("¿Es transpirable?");
            assertThat(captor.getValue().getProduct()).isEqualTo(product);
            assertThat(captor.getValue().getUser()).isEqualTo(user);
        }
    }

    // ── answerQuestion ────────────────────────────────────────────────────────

    @Nested
    class AnswerQuestion {

        @Test
        void throwsWhenQuestionNotFound() {
            when(questionRepository.findById(404L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> productQAService.answerQuestion(404L, 1L, "Respuesta"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void setsAnswerAndAnsweredAt() {
            ProductQuestion question = ProductQuestion.builder()
                    .id(1L).product(product).user(user)
                    .question("¿Tiene garantía?")
                    .build();

            User admin = User.builder().id(2L).email("admin@test.com")
                    .firstName("Admin").lastName("User")
                    .role(UserRole.ADMIN).enabled(true).build();

            when(questionRepository.findById(1L)).thenReturn(Optional.of(question));
            when(userRepository.findById(2L)).thenReturn(Optional.of(admin));
            when(questionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            productQAService.answerQuestion(1L, 2L, "Sí, tiene 6 meses.");

            assertThat(question.getAnswer()).isEqualTo("Sí, tiene 6 meses.");
            assertThat(question.getAnsweredBy()).isEqualTo(admin);
            assertThat(question.getAnsweredAt()).isNotNull();
        }
    }
}
