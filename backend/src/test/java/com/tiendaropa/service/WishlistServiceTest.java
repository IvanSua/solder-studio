package com.tiendaropa.service;

import com.tiendaropa.entity.WishlistItem;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.WishlistItemRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WishlistServiceTest {

    @Mock WishlistItemRepository wishlistRepo;
    @Mock ProductRepository productRepo;
    @Mock ProductService productService;

    @InjectMocks WishlistService wishlistService;

    // ── toggle ────────────────────────────────────────────────────────────────

    @Nested
    class Toggle {

        @Test
        void productoNoEstaEnWishlist_loAgregaYRetornaTrue() {
            when(productRepo.existsById(10L)).thenReturn(true);
            when(wishlistRepo.findByUserIdAndProductId(1L, 10L)).thenReturn(Optional.empty());

            boolean result = wishlistService.toggle(1L, 10L);

            assertThat(result).isTrue();
            verify(wishlistRepo).save(any(WishlistItem.class));
        }

        @Test
        void productoYaEstaEnWishlist_loEliminaYRetornaFalse() {
            WishlistItem existing = WishlistItem.builder().id(1L).userId(1L).productId(10L).build();
            when(productRepo.existsById(10L)).thenReturn(true);
            when(wishlistRepo.findByUserIdAndProductId(1L, 10L)).thenReturn(Optional.of(existing));

            boolean result = wishlistService.toggle(1L, 10L);

            assertThat(result).isFalse();
            verify(wishlistRepo).delete(existing);
        }

        @Test
        void productoNoExiste_lanzaResourceNotFoundException() {
            when(productRepo.existsById(999L)).thenReturn(false);

            assertThatThrownBy(() -> wishlistService.toggle(1L, 999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Product not found");
        }
    }

    // ── isWishlisted ─────────────────────────────────────────────────────────

    @Nested
    class IsWishlisted {

        @Test
        void productoEnWishlist_retornaTrue() {
            when(wishlistRepo.existsByUserIdAndProductId(1L, 10L)).thenReturn(true);

            assertThat(wishlistService.isWishlisted(1L, 10L)).isTrue();
        }

        @Test
        void productoFueraDeWishlist_retornaFalse() {
            when(wishlistRepo.existsByUserIdAndProductId(1L, 99L)).thenReturn(false);

            assertThat(wishlistService.isWishlisted(1L, 99L)).isFalse();
        }
    }

    // ── getWishlistedProductIds ───────────────────────────────────────────────

    @Nested
    class GetWishlistedProductIds {

        @Test
        void retornaSetDeIdsDeProductosEnWishlist() {
            WishlistItem item1 = WishlistItem.builder().id(1L).userId(1L).productId(10L).build();
            WishlistItem item2 = WishlistItem.builder().id(2L).userId(1L).productId(20L).build();
            when(wishlistRepo.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(item1, item2));

            Set<Long> ids = wishlistService.getWishlistedProductIds(1L);

            assertThat(ids).containsExactlyInAnyOrder(10L, 20L);
        }

        @Test
        void wishlistVacia_retornaSetVacio() {
            when(wishlistRepo.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

            Set<Long> ids = wishlistService.getWishlistedProductIds(1L);

            assertThat(ids).isEmpty();
        }
    }
}
