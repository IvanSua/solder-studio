package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreateReviewRequest;
import com.tiendaropa.dto.response.ReviewResponse;
import com.tiendaropa.dto.response.ReviewSummaryResponse;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductReview;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.ProductReviewRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReviewServiceTest {

    @Mock ProductReviewRepository reviewRepository;
    @Mock ProductRepository productRepository;
    @Mock UserRepository userRepository;
    @Mock OrderRepository orderRepository;

    @InjectMocks ReviewService reviewService;

    private Product product;
    private User user;

    @BeforeEach
    void setUp() {
        product = Product.builder()
                .id(1L).name("Remera").slug("remera").active(true)
                .build();

        user = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("Sanchez")
                .role(UserRole.CUSTOMER).enabled(true)
                .build();
    }

    // ── createReview ─────────────────────────────────────────────────────────

    @Nested
    class CreateReview {

        private CreateReviewRequest req(int rating) {
            CreateReviewRequest r = new CreateReviewRequest();
            r.setRating((short) rating);
            r.setTitle("Muy buena");
            r.setBody("Me encantó el producto");
            return r;
        }

        @Test
        void productoYUsuarioExisten_creaResena() {
            ProductReview saved = ProductReview.builder()
                    .id(1L).product(product).user(user)
                    .rating((short) 5).title("Muy buena").body("Me encantó")
                    .verifiedPurchase(true).createdAt(Instant.now())
                    .build();

            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(reviewRepository.existsByProductIdAndUserId(1L, 1L)).thenReturn(false);
            when(orderRepository.existsDeliveredOrderForUserAndProduct(1L, 1L)).thenReturn(true);
            when(reviewRepository.save(any(ProductReview.class))).thenReturn(saved);

            ReviewResponse response = reviewService.createReview("remera", 1L, req(5));

            assertThat(response.getRating()).isEqualTo((short) 5);
            assertThat(response.getVerifiedPurchase()).isTrue();
        }

        @Test
        void usuarioYaResenoElProducto_lanzaBusinessException() {
            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(reviewRepository.existsByProductIdAndUserId(1L, 1L)).thenReturn(true);

            assertThatThrownBy(() -> reviewService.createReview("remera", 1L, req(4)))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void productoNoExiste_lanzaResourceNotFoundException() {
            when(productRepository.findBySlug("no-existe")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> reviewService.createReview("no-existe", 1L, req(3)))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void sinOrdenEntregada_verifiedPurchaseEsFalse() {
            ProductReview saved = ProductReview.builder()
                    .id(1L).product(product).user(user)
                    .rating((short) 4).title("Bien").body("Está bien")
                    .verifiedPurchase(false).createdAt(Instant.now())
                    .build();

            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(reviewRepository.existsByProductIdAndUserId(1L, 1L)).thenReturn(false);
            when(orderRepository.existsDeliveredOrderForUserAndProduct(1L, 1L)).thenReturn(false);
            when(reviewRepository.save(any(ProductReview.class))).thenReturn(saved);

            ReviewResponse response = reviewService.createReview("remera", 1L, req(4));

            assertThat(response.getVerifiedPurchase()).isFalse();
        }
    }

    // ── getReviews ────────────────────────────────────────────────────────────

    @Nested
    class GetReviews {

        @Test
        void productoConResenas_retornaSummaryCompleto() {
            ProductReview r1 = ProductReview.builder()
                    .id(1L).product(product).user(user)
                    .rating((short) 5).title("Excelente").body("10/10")
                    .verifiedPurchase(true).createdAt(Instant.now())
                    .build();
            ProductReview r2 = ProductReview.builder()
                    .id(2L).product(product).user(user)
                    .rating((short) 4).title("Buena").body("Muy buena")
                    .verifiedPurchase(false).createdAt(Instant.now())
                    .build();

            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(reviewRepository.findByProductIdOrderByCreatedAtDesc(eq(1L), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of(r1, r2)));
            when(reviewRepository.findAverageRatingByProductId(1L)).thenReturn(4.5);
            when(reviewRepository.countByProductId(1L)).thenReturn(2L);
            when(reviewRepository.existsByProductIdAndUserId(1L, 1L)).thenReturn(false);

            ReviewSummaryResponse summary = reviewService.getReviews("remera", 1L);

            assertThat(summary.getTotalReviews()).isEqualTo(2L);
            assertThat(summary.getAverageRating()).isEqualTo(4.5);
            assertThat(summary.getReviews()).hasSize(2);
            assertThat(summary.getRatingDistribution()).containsKey(5);
            assertThat(summary.getRatingDistribution()).containsKey(4);
        }

        @Test
        void sinResenas_retornaSummaryVacio() {
            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(reviewRepository.findByProductIdOrderByCreatedAtDesc(eq(1L), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reviewRepository.findAverageRatingByProductId(1L)).thenReturn(null);
            when(reviewRepository.countByProductId(1L)).thenReturn(0L);
            when(reviewRepository.existsByProductIdAndUserId(1L, null)).thenReturn(false);

            ReviewSummaryResponse summary = reviewService.getReviews("remera", null);

            assertThat(summary.getTotalReviews()).isZero();
            assertThat(summary.getAverageRating()).isNull();
            assertThat(summary.getReviews()).isEmpty();
        }

        @Test
        void usuarioYaResenoProducto_userHasReviewedEsTrue() {
            when(productRepository.findBySlug("remera")).thenReturn(Optional.of(product));
            when(reviewRepository.findByProductIdOrderByCreatedAtDesc(eq(1L), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reviewRepository.findAverageRatingByProductId(1L)).thenReturn(null);
            when(reviewRepository.countByProductId(1L)).thenReturn(0L);
            when(reviewRepository.existsByProductIdAndUserId(1L, 1L)).thenReturn(true);

            ReviewSummaryResponse summary = reviewService.getReviews("remera", 1L);

            assertThat(summary.getUserHasReviewed()).isTrue();
        }
    }
}
