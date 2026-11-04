package com.tiendaropa.service;

import com.tiendaropa.config.properties.ApplicationProperties;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.spring6.SpringTemplateEngine;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EmailServiceTest {

    @Mock JavaMailSender       mailSender;
    @Mock SpringTemplateEngine templateEngine;
    @Mock ApplicationProperties appProperties;

    @InjectMocks EmailService emailService;

    @BeforeEach
    void setUp() {
        when(appProperties.frontendUrl()).thenReturn("http://localhost:4200");
    }

    // ── notConfigured guard ───────────────────────────────────────────────────

    @Nested
    class NotConfigured {

        @BeforeEach
        void setBlankFrom() {
            ReflectionTestUtils.setField(emailService, "fromAddress", "");
        }

        @Test
        void doesNotSendWelcomeEmail() {
            emailService.sendWelcomeEmail("u@test.com", "Ana", "REF123");
            verifyNoInteractions(mailSender, templateEngine);
        }

        @Test
        void doesNotSendVerificationEmail() {
            emailService.sendVerificationEmail("u@test.com", "Ana", "token-abc");
            verifyNoInteractions(mailSender, templateEngine);
        }

        @Test
        void doesNotSendPasswordResetEmail() {
            emailService.sendPasswordResetEmail("u@test.com", "Ana", "reset-token");
            verifyNoInteractions(mailSender, templateEngine);
        }

        @Test
        void doesNotSendRestockEmail() {
            emailService.sendRestockEmail("u@test.com", "Ana", "Remera Negra", "remera-negra");
            verifyNoInteractions(mailSender, templateEngine);
        }

        @Test
        void doesNotSendAbandonedCartEmail() {
            emailService.sendAbandonedCartEmail("u@test.com", "Ana", 3);
            verifyNoInteractions(mailSender, templateEngine);
        }

        @Test
        void doesNotSendOrderStatusUpdate() {
            emailService.sendOrderStatusUpdate(1L, "shipped", "u@test.com", "Ana");
            verifyNoInteractions(mailSender, templateEngine);
        }
    }

    // ── configured: sends mail ────────────────────────────────────────────────

    @Nested
    class Configured {

        @BeforeEach
        void setFrom() {
            ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@solderstudio.com");
            when(templateEngine.process(anyString(), any())).thenReturn("<html>email</html>");
            when(mailSender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));
        }

        @Test
        void sendsWelcomeEmail() {
            emailService.sendWelcomeEmail("u@test.com", "Ana", "REF123");

            verify(templateEngine).process(eq("email/welcome"), any());
            verify(mailSender).send(any(MimeMessage.class));
        }

        @Test
        void sendsVerificationEmail() {
            emailService.sendVerificationEmail("u@test.com", "Ana", "token-xyz");

            verify(templateEngine).process(eq("email/verify-email"), any());
            verify(mailSender).send(any(MimeMessage.class));
        }

        @Test
        void sendsPasswordResetEmail() {
            emailService.sendPasswordResetEmail("u@test.com", "Ana", "reset-abc");

            verify(templateEngine).process(eq("email/password-reset"), any());
            verify(mailSender).send(any(MimeMessage.class));
        }

        @Test
        void sendsRestockEmail() {
            emailService.sendRestockEmail("u@test.com", "Ana", "Camiseta Negra", "camiseta-negra");

            verify(templateEngine).process(eq("email/restock"), any());
            verify(mailSender).send(any(MimeMessage.class));
        }

        @Test
        void sendsOrderStatusUpdate() {
            emailService.sendOrderStatusUpdate(42L, "shipped", "u@test.com", "Ana");

            verify(templateEngine).process(eq("email/order-status"), any());
            verify(mailSender).send(any(MimeMessage.class));
        }
    }

    // ── i18n helpers ──────────────────────────────────────────────────────────

    @Nested
    class I18nHelpers {

        @Test
        void statusIconForReturnReturnsCorrectEmoji() {
            org.assertj.core.api.Assertions.assertThat(emailService.statusIconForReturn("APPROVED")).isEqualTo("✅");
            org.assertj.core.api.Assertions.assertThat(emailService.statusIconForReturn("REJECTED")).isEqualTo("❌");
            org.assertj.core.api.Assertions.assertThat(emailService.statusIconForReturn("UNKNOWN")).isEqualTo("📦");
        }

        @Test
        void loyaltyReasonLabelReturnsCorrectLabel() {
            org.assertj.core.api.Assertions.assertThat(emailService.loyaltyReasonLabel("ORDER_DELIVERED"))
                    .isEqualTo("Pedido entregado");
            org.assertj.core.api.Assertions.assertThat(emailService.loyaltyReasonLabel(null))
                    .isEqualTo("Puntos ganados");
            org.assertj.core.api.Assertions.assertThat(emailService.loyaltyReasonLabel("UNKNOWN_KEY"))
                    .isEqualTo("Puntos ganados");
        }
    }
}
