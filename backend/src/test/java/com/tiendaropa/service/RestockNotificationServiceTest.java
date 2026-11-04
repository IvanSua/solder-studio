package com.tiendaropa.service;

import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.User;
import com.tiendaropa.entity.WishlistItem;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.repository.WishlistItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestockNotificationServiceTest {

    @Mock WishlistItemRepository wishlistItemRepository;
    @Mock UserRepository         userRepository;
    @Mock EmailService           emailService;
    @Mock NotificationService    notificationService;

    @InjectMocks RestockNotificationService restockService;

    private Product product;

    @BeforeEach
    void setUp() {
        product = Product.builder()
                .id(1L)
                .name("Camiseta Negra")
                .slug("camiseta-negra")
                .build();
    }

    // ── notifyWishlistUsers ───────────────────────────────────────────────────

    @Nested
    class NotifyWishlistUsers {

        @Test
        void doesNothingWhenNoWishlistEntries() {
            when(wishlistItemRepository.findByProductId(1L)).thenReturn(List.of());

            restockService.notifyWishlistUsers(product);

            verifyNoInteractions(userRepository, emailService, notificationService);
        }

        @Test
        void sendsEmailAndNotificationToEachActiveUser() {
            WishlistItem item1 = WishlistItem.builder().id(1L).userId(10L).build();
            WishlistItem item2 = WishlistItem.builder().id(2L).userId(20L).build();

            User user1 = buildUser(10L, "ana@test.com", true);
            User user2 = buildUser(20L, "beto@test.com", true);

            when(wishlistItemRepository.findByProductId(1L)).thenReturn(List.of(item1, item2));
            when(userRepository.findById(10L)).thenReturn(Optional.of(user1));
            when(userRepository.findById(20L)).thenReturn(Optional.of(user2));

            restockService.notifyWishlistUsers(product);

            verify(emailService, times(2)).sendRestockEmail(anyString(), anyString(), anyString(), anyString());
            verify(notificationService, times(2)).createAsync(anyLong(), any(), anyString(), anyString(), anyString());
        }

        @Test
        void skipsDisabledUsers() {
            WishlistItem item = WishlistItem.builder().id(1L).userId(10L).build();
            User disabledUser = buildUser(10L, "disabled@test.com", false);

            when(wishlistItemRepository.findByProductId(1L)).thenReturn(List.of(item));
            when(userRepository.findById(10L)).thenReturn(Optional.of(disabledUser));

            restockService.notifyWishlistUsers(product);

            verifyNoInteractions(emailService, notificationService);
        }

        @Test
        void skipsUsersWithNullEmail() {
            WishlistItem item = WishlistItem.builder().id(1L).userId(10L).build();
            User userWithoutEmail = User.builder()
                    .id(10L).email(null).enabled(true)
                    .role(UserRole.CUSTOMER).build();

            when(wishlistItemRepository.findByProductId(1L)).thenReturn(List.of(item));
            when(userRepository.findById(10L)).thenReturn(Optional.of(userWithoutEmail));

            restockService.notifyWishlistUsers(product);

            verifyNoInteractions(emailService, notificationService);
        }

        @Test
        void skipsWhenUserNotFoundInRepo() {
            WishlistItem item = WishlistItem.builder().id(1L).userId(99L).build();

            when(wishlistItemRepository.findByProductId(1L)).thenReturn(List.of(item));
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            restockService.notifyWishlistUsers(product);

            verifyNoInteractions(emailService, notificationService);
        }
    }

    private User buildUser(Long id, String email, boolean enabled) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Test")
                .lastName("User")
                .enabled(enabled)
                .role(UserRole.CUSTOMER)
                .build();
    }
}
