package com.tiendaropa.service;

import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.WishlistItem;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.repository.WishlistItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Sends restock notifications (email + in-app) to wishlist users when a product
 * variant's stock is replenished from zero.
 *
 * Called by AdminProductController after a variant stock update.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RestockNotificationService {

    private final WishlistItemRepository wishlistItemRepository;
    private final UserRepository         userRepository;
    private final EmailService           emailService;
    private final NotificationService    notificationService;

    /**
     * Finds all users who have {@code product} in their wishlist and sends each:
     * <ol>
     *   <li>An async restock email via {@link EmailService#sendRestockEmail}.</li>
     *   <li>An in-app notification via {@link NotificationService#createAsync}.</li>
     * </ol>
     *
     * @param product the restocked product (must have id, name, slug populated)
     */
    @Async
    @Transactional(readOnly = true)
    public void notifyWishlistUsers(Product product) {
        List<WishlistItem> wishlistEntries = wishlistItemRepository.findByProductId(product.getId());
        if (wishlistEntries.isEmpty()) {
            log.debug("Restock: no wishlist entries for product '{}' (id={})", product.getName(), product.getId());
            return;
        }

        log.info("Restock: notifying {} wishlist user(s) for product '{}' (id={})",
                wishlistEntries.size(), product.getName(), product.getId());

        String productLink = "/producto/" + product.getSlug();

        for (WishlistItem entry : wishlistEntries) {
            userRepository.findById(entry.getUserId()).ifPresent(user -> {
                if (!user.isEnabled() || user.getEmail() == null) return;

                // 1) Email (already @Async inside EmailService)
                emailService.sendRestockEmail(
                        user.getEmail(),
                        user.getFirstName(),
                        product.getName(),
                        product.getSlug());

                // 2) In-app notification
                notificationService.createAsync(
                        user.getId(),
                        NotificationType.RESTOCK,
                        "¡Volvió el stock!",
                        product.getName() + " que tenés en tu lista de deseos está disponible nuevamente.",
                        productLink);
            });
        }
    }
}
