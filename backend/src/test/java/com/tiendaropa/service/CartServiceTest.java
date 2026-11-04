package com.tiendaropa.service;

import com.tiendaropa.dto.request.CartItemRequest;
import com.tiendaropa.dto.response.CartResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock CartRepository cartRepository;
    @Mock ProductVariantRepository variantRepository;
    @Mock CustomDesignRepository designRepository;
    @Mock UserRepository userRepository;
    @Mock StorageService storageService;
    @InjectMocks CartService cartService;

    private User user;
    private Product product;
    private ProductVariant variant;
    private Cart emptyCart;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("S")
                .passwordHash("hash")
                .build();

        product = Product.builder()
                .id(1L).name("Remera Negra").slug("remera-negra")
                .images(new ArrayList<>())
                .build();

        variant = ProductVariant.builder()
                .id(10L).product(product)
                .priceAmount(5000L).currencyCode("ARS")
                .color("Negro").size("M")
                .build();

        emptyCart = Cart.builder().id(1L).user(user).build();
    }

    // ─── getCart ─────────────────────────────────────────────────────────────

    @Nested
    class GetCart {

        @Test
        void existingCart_returnsCartResponse() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));

            CartResponse response = cartService.getCart(1L);

            assertThat(response.getCartId()).isEqualTo(1L);
            assertThat(response.getItems()).isEmpty();
            assertThat(response.getTotalAmount()).isZero();
            assertThat(response.getCurrencyCode()).isEqualTo("ARS");
        }

        @Test
        void noCart_createsAndReturnsNewCart() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCart);

            CartResponse response = cartService.getCart(1L);

            verify(cartRepository).save(any(Cart.class));
            assertThat(response).isNotNull();
        }

        @Test
        void noCartAndUserNotFound_throwsResourceNotFoundException() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());
            when(userRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> cartService.getCart(1L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void cartWithItems_calculatesTotalCorrectly() {
            ProductVariant variant2 = ProductVariant.builder()
                    .id(11L).product(product)
                    .priceAmount(3000L).currencyCode("ARS")
                    .color("Blanco").size("L")
                    .build();

            CartItem item1 = CartItem.builder().id(1L).cart(emptyCart).productVariant(variant).quantity(2).build();
            CartItem item2 = CartItem.builder().id(2L).cart(emptyCart).productVariant(variant2).quantity(1).build();
            emptyCart.getItems().add(item1);
            emptyCart.getItems().add(item2);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));

            CartResponse response = cartService.getCart(1L);

            // 5000*2 + 3000*1 = 13000
            assertThat(response.getTotalAmount()).isEqualTo(13000L);
            assertThat(response.getItems()).hasSize(2);
        }
    }

    // ─── addItem ─────────────────────────────────────────────────────────────

    @Nested
    class AddItem {

        @Test
        void validRequest_addsItemAndReturnsUpdatedCart() {
            CartItemRequest request = new CartItemRequest();
            request.setProductVariantId(10L);
            request.setQuantity(2);

            CartItem savedItem = CartItem.builder().id(1L).cart(emptyCart).productVariant(variant).quantity(2).build();
            Cart savedCart = Cart.builder().id(1L).user(user).build();
            savedCart.getItems().add(savedItem);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(cartRepository.save(any(Cart.class))).thenReturn(savedCart);

            CartResponse response = cartService.addItem(1L, request);

            assertThat(response.getItems()).hasSize(1);
            assertThat(response.getItems().get(0).getProductVariantId()).isEqualTo(10L);
            assertThat(response.getItems().get(0).getQuantity()).isEqualTo(2);
        }

        @Test
        void variantNotFound_throwsResourceNotFoundException() {
            CartItemRequest request = new CartItemRequest();
            request.setProductVariantId(999L);
            request.setQuantity(1);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(variantRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> cartService.addItem(1L, request))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Product variant not found");
        }

        @Test
        void designNotFound_throwsResourceNotFoundException() {
            CartItemRequest request = new CartItemRequest();
            request.setProductVariantId(10L);
            request.setQuantity(1);
            request.setCustomDesignId(5L);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(designRepository.findByIdAndUserId(5L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> cartService.addItem(1L, request))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Custom design not found");
        }

        @Test
        void designIncompatibleWithVariant_throwsBusinessException() {
            CartItemRequest request = new CartItemRequest();
            request.setProductVariantId(10L);
            request.setQuantity(1);
            request.setCustomDesignId(5L);

            ProductVariant otherVariant = ProductVariant.builder().id(99L).product(product).priceAmount(3000L).currencyCode("ARS").build();
            CustomDesign design = CustomDesign.builder().id(5L).productVariant(otherVariant).build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(designRepository.findByIdAndUserId(5L, 1L)).thenReturn(Optional.of(design));

            assertThatThrownBy(() -> cartService.addItem(1L, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Design is not compatible");
        }
    }

    // ─── removeItem ──────────────────────────────────────────────────────────

    @Nested
    class RemoveItem {

        @Test
        void existingItem_removesItAndReturnsEmptyCart() {
            CartItem item = CartItem.builder().id(42L).cart(emptyCart).productVariant(variant).quantity(1).build();
            emptyCart.getItems().add(item);

            Cart emptyCartAfterRemoval = Cart.builder().id(1L).user(user).build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCartAfterRemoval);

            CartResponse response = cartService.removeItem(1L, 42L);

            assertThat(response.getItems()).isEmpty();
            assertThat(response.getTotalAmount()).isZero();
        }

        @Test
        void nonExistentItemId_returnsSameCart() {
            CartItem item = CartItem.builder().id(1L).cart(emptyCart).productVariant(variant).quantity(2).build();
            emptyCart.getItems().add(item);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCart);

            // removeIf doesn't throw — it just does nothing
            CartResponse response = cartService.removeItem(1L, 999L);

            assertThat(response).isNotNull();
        }
    }

    // ─── updateQuantity ───────────────────────────────────────────────────────

    @Nested
    class UpdateQuantity {

        @Test
        void positiveQty_updatesItemQuantity() {
            CartItem item = CartItem.builder().id(42L).cart(emptyCart).productVariant(variant).quantity(1).build();
            emptyCart.getItems().add(item);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCart);

            cartService.updateQuantity(1L, 42L, 5);

            assertThat(item.getQuantity()).isEqualTo(5);
            verify(cartRepository).save(emptyCart);
        }

        @Test
        void zeroQty_removesItemFromCart() {
            CartItem item = CartItem.builder().id(42L).cart(emptyCart).productVariant(variant).quantity(2).build();
            emptyCart.getItems().add(item);

            Cart emptyCartAfterRemoval = Cart.builder().id(1L).user(user).build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCartAfterRemoval);

            CartResponse response = cartService.updateQuantity(1L, 42L, 0);

            assertThat(response.getItems()).isEmpty();
        }

        @Test
        void negativeQty_removesItemFromCart() {
            CartItem item = CartItem.builder().id(42L).cart(emptyCart).productVariant(variant).quantity(1).build();
            emptyCart.getItems().add(item);

            Cart emptyCartAfterRemoval = Cart.builder().id(1L).user(user).build();

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCartAfterRemoval);

            CartResponse response = cartService.updateQuantity(1L, 42L, -1);

            assertThat(response.getItems()).isEmpty();
        }

        @Test
        void itemNotFound_throwsResourceNotFoundException() {
            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));

            assertThatThrownBy(() -> cartService.updateQuantity(1L, 999L, 3))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Cart item not found");
        }

        @Test
        void sameQuantity_stillSaves() {
            CartItem item = CartItem.builder().id(42L).cart(emptyCart).productVariant(variant).quantity(3).build();
            emptyCart.getItems().add(item);

            when(cartRepository.findByUserIdWithItems(1L)).thenReturn(Optional.of(emptyCart));
            when(cartRepository.save(any(Cart.class))).thenReturn(emptyCart);

            cartService.updateQuantity(1L, 42L, 3);

            verify(cartRepository).save(emptyCart);
        }
    }
}
