package com.tiendaropa.service;

import com.tiendaropa.dto.request.CartItemRequest;
import com.tiendaropa.dto.response.CartResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CartRepository;
import com.tiendaropa.repository.CustomDesignRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartService {

    private final CartRepository cartRepository;
    private final ProductVariantRepository variantRepository;
    private final CustomDesignRepository designRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    @Transactional
    public CartResponse getCart(Long userId) {
        Cart cart = getOrCreateCart(userId);
        return mapToResponse(cart);
    }

    @Transactional
    public CartResponse addItem(Long userId, CartItemRequest request) {
        Cart cart = getOrCreateCart(userId);

        ProductVariant variant = variantRepository.findById(request.getProductVariantId())
                .orElseThrow(() -> new ResourceNotFoundException("Product variant not found"));

        CustomDesign design = null;
        if (request.getCustomDesignId() != null) {
            design = designRepository.findByIdAndUserId(request.getCustomDesignId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Custom design not found"));

            if (!design.getProductVariant().getId().equals(variant.getId())) {
                throw new BusinessException("Design is not compatible with this variant", HttpStatus.CONFLICT);
            }
        }

        CartItem item = CartItem.builder()
                .cart(cart)
                .productVariant(variant)
                .quantity(request.getQuantity())
                .customDesign(design)
                .build();

        cart.getItems().add(item);
        cart = cartRepository.save(cart);
        return mapToResponse(cart);
    }

    /** Empties the cart entirely. Used by GuestCheckoutService to make sure a
     *  reused guest account never carries over items from a previous, abandoned
     *  guest checkout attempt. */
    @Transactional
    public void clearCart(Long userId) {
        Cart cart = getOrCreateCart(userId);
        cart.getItems().clear();
        cartRepository.save(cart);
    }

    @Transactional
    public CartResponse removeItem(Long userId, Long itemId) {
        Cart cart = getOrCreateCart(userId);
        cart.getItems().removeIf(item -> item.getId().equals(itemId));
        cart = cartRepository.save(cart);
        return mapToResponse(cart);
    }

    @Transactional
    public CartResponse updateQuantity(Long userId, Long itemId, int quantity) {
        if (quantity <= 0) {
            return removeItem(userId, itemId);
        }
        Cart cart = getOrCreateCart(userId);
        cart.getItems().stream()
                .filter(item -> item.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Cart item not found: " + itemId))
                .setQuantity(quantity);
        cart = cartRepository.save(cart);
        return mapToResponse(cart);
    }

    private Cart getOrCreateCart(Long userId) {
        return cartRepository.findByUserIdWithItems(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
                    return cartRepository.save(Cart.builder().user(user).build());
                });
    }

    private CartResponse mapToResponse(Cart cart) {
        long total = 0;
        var items = cart.getItems().stream().map(item -> {
            var variant = item.getProductVariant();
            var product = variant.getProduct();

            // Resolve primary image for the product (null-safe)
            String imageUrl = null;
            if (product != null && product.getImages() != null) {
                Optional<ProductImage> primaryImg = product.getImages().stream()
                        .filter(ProductImage::isPrimary)
                        .findFirst();
                if (primaryImg.isEmpty() && !product.getImages().isEmpty()) {
                    primaryImg = Optional.of(product.getImages().get(0));
                }
                if (primaryImg.isPresent()) {
                    imageUrl = resolveImageUrl(primaryImg.get().getImageUrl());
                }
            }

            return CartResponse.CartItemResponse.builder()
                    .cartItemId(item.getId())
                    .productVariantId(variant.getId())
                    .productName(product != null ? product.getName() : "")
                    .productSlug(product != null ? product.getSlug() : null)
                    .imageUrl(imageUrl)
                    .color(variant.getColor())
                    .size(variant.getSize())
                    .quantity(item.getQuantity())
                    .unitPrice(variant.getPriceAmount())
                    .currencyCode(variant.getCurrencyCode())
                    .customDesignId(item.getCustomDesign() != null ? item.getCustomDesign().getId() : null)
                    .build();
        }).toList();

        for (var item : items) {
            total += item.getUnitPrice() * item.getQuantity();
        }

        return CartResponse.builder()
                .cartId(cart.getId())
                .items(items)
                .totalAmount(total)
                .currencyCode("ARS")
                .build();
    }

    private String resolveImageUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
            return storedUrl;
        }
        try {
            return storageService.getPresignedUrl(storedUrl);
        } catch (Exception e) {
            return storedUrl;
        }
    }
}
