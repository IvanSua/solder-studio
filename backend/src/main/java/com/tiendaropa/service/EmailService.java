package com.tiendaropa.service;

import com.tiendaropa.entity.GiftCard;
import com.tiendaropa.entity.Order;
import com.tiendaropa.config.properties.ApplicationProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Locale;

/**
 * Sends transactional emails using Thymeleaf HTML templates.
 * All sends are {@code @Async} so they never block the main thread.
 * If mail is not configured the service silently logs a warning.
 */
@Service
@Slf4j
public class EmailService {

    private final JavaMailSender       mailSender;
    private final SpringTemplateEngine templateEngine;
    private final ApplicationProperties appProperties;

    /** Sourced from Spring's standard mail auto-configuration — kept as @Value intentionally. */
    @Value("${spring.mail.username:}")
    private String fromAddress;

    public EmailService(JavaMailSender mailSender,
                        SpringTemplateEngine templateEngine,
                        ApplicationProperties appProperties) {
        this.mailSender     = mailSender;
        this.templateEngine = templateEngine;
        this.appProperties  = appProperties;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Order confirmation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Send an order confirmation email after a successful payment.
     * User data (email, firstName) must be resolved <em>before</em> calling this method
     * (inside the active JPA transaction) to avoid LazyInitializationException in the async thread.
     */
    @Async
    public void sendOrderConfirmation(Order order, String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping order confirmation for order {}", order.getId());
            return;
        }
        String subject = "Solder Studio – Pedido #" + order.getId() + " confirmado";

        Context ctx = baseContext();
        ctx.setVariable("firstName", userFirstName);
        ctx.setVariable("order",     order);
        ctx.setVariable("ordersUrl", appProperties.frontendUrl() + "/orders");

        send(userEmail, subject, "email/order-confirmation", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Welcome email
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendWelcomeEmail(String toEmail, String firstName, String referralCode) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping welcome email for {}", toEmail);
            return;
        }
        String subject = "¡Bienvenido/a a Solder Studio! 🎉";

        Context ctx = baseContext();
        ctx.setVariable("firstName",    firstName);
        ctx.setVariable("referralCode", referralCode);

        send(toEmail, subject, "email/welcome", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Email verification
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendVerificationEmail(String toEmail, String firstName, String token) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping verification email for {}", toEmail);
            return;
        }
        String subject = "Solder Studio – Verificá tu dirección de email";

        Context ctx = baseContext();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("verifyUrl", appProperties.frontendUrl() + "/verificar-email?token=" + token);

        send(toEmail, subject, "email/verify-email", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Abandoned cart
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendAbandonedCartEmail(String toEmail, String firstName, int itemCount) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping abandoned cart email for {}", toEmail);
            return;
        }
        String subject = firstName + ", ¡olvidaste algo en tu carrito! 🛒";

        Context ctx = baseContext();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("itemCount", itemCount);
        ctx.setVariable("cartUrl",   appProperties.frontendUrl() + "/carrito");

        send(toEmail, subject, "email/abandoned-cart", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Restock notification
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendRestockEmail(String toEmail, String firstName, String productName, String productSlug) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping restock email for {}", toEmail);
            return;
        }
        String subject = "¡Volvió el stock! " + productName + " ya está disponible 🎉";

        Context ctx = baseContext();
        ctx.setVariable("firstName",   firstName);
        ctx.setVariable("productName", productName);
        ctx.setVariable("productUrl",  appProperties.frontendUrl() + "/producto/" + productSlug);

        send(toEmail, subject, "email/restock", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Order status update
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendOrderStatusUpdate(Long orderId, String newStatus, String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping status update email for order {}", orderId);
            return;
        }
        String statusLabel = translateStatus(newStatus);
        String subject     = "Tu pedido #" + orderId + " — " + statusLabel;

        Context ctx = baseContext();
        ctx.setVariable("firstName",   userFirstName);
        ctx.setVariable("orderId",     orderId);
        ctx.setVariable("statusKey",   newStatus);
        ctx.setVariable("statusLabel", statusLabel);
        ctx.setVariable("icon",        statusIcon(newStatus));
        ctx.setVariable("ordersUrl",   appProperties.frontendUrl() + "/orders");

        send(userEmail, subject, "email/order-status", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Tracking update
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendTrackingUpdate(Long orderId, String trackingNumber, String trackingUrl,
                                   String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping tracking email for order {}", orderId);
            return;
        }
        String subject = "Tu pedido #" + orderId + " está en camino 🚚";

        Context ctx = baseContext();
        ctx.setVariable("firstName",      userFirstName);
        ctx.setVariable("orderId",        orderId);
        ctx.setVariable("trackingNumber", trackingNumber);
        ctx.setVariable("trackingUrl",    trackingUrl);
        ctx.setVariable("orderDetailUrl", appProperties.frontendUrl() + "/orders/" + orderId);

        send(userEmail, subject, "email/tracking", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Password reset
    // ──────────────────────────────────────────────────────────────────────────

    @Async
    public void sendPasswordResetEmail(String toEmail, String firstName, String token) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping password reset email for {}", toEmail);
            return;
        }
        String subject = "Restablecer contraseña – Solder Studio";

        Context ctx = baseContext();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("resetUrl",  appProperties.frontendUrl() + "/auth/reset-password?token=" + token);

        send(toEmail, subject, "email/password-reset", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Return status update
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Send an email when a return request changes status.
     */
    @Async
    public void sendReturnStatusUpdate(Long returnId, Long orderId, String newStatus,
                                       String statusMessage, String resolution,
                                       String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping return status email for return {}", returnId);
            return;
        }
        String subject = "Actualización de tu devolución #" + returnId;

        Context ctx = baseContext();
        ctx.setVariable("firstName",      userFirstName);
        ctx.setVariable("returnId",      returnId);
        ctx.setVariable("orderId",       orderId);
        ctx.setVariable("status",        newStatus);
        ctx.setVariable("statusMessage", statusMessage);
        ctx.setVariable("resolution",   resolution);
        ctx.setVariable("ordersUrl",    appProperties.frontendUrl() + "/orders");

        send(userEmail, subject, "email/return-status", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Points awarded
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Send an email when loyalty points are awarded to a user.
     */
    @Async
    public void sendPointsAwarded(int pointsAwarded, int totalPoints, String reason,
                                  String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping points email for {}", userEmail);
            return;
        }
        String subject = "¡Ganaste " + pointsAwarded + " puntos en Solder Studio! 🎉";

        Context ctx = baseContext();
        ctx.setVariable("firstName",    userFirstName);
        ctx.setVariable("pointsAwarded", pointsAwarded);
        ctx.setVariable("totalPoints",  totalPoints);
        ctx.setVariable("reason",       reason);
        ctx.setVariable("loyaltyUrl",  appProperties.frontendUrl() + "/mi-cuenta/puntos");

        send(userEmail, subject, "email/points-awarded", ctx);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Gift Card purchased
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Send an email when a gift card is purchased.
     */
    @Async
    public void sendGiftCardEmail(GiftCard giftCard, String userEmail, String userFirstName) {
        if (notConfigured()) {
            log.warn("Mail not configured — skipping gift card email for {}", userEmail);
            return;
        }
        String subject = "🎁 Tu Gift Card de " + formatCurrency(giftCard.getInitialAmount()) + " está lista";

        Context ctx = baseContext();
        ctx.setVariable("firstName",    userFirstName);
        ctx.setVariable("giftCardCode", giftCard.getCode());
        ctx.setVariable("amount",       formatCurrency(giftCard.getInitialAmount()) + " ARS");
        ctx.setVariable("balance",      formatCurrency(giftCard.getRemainingAmount()) + " ARS");
        ctx.setVariable("expiryDate",   formatExpiryDate(giftCard.getExpiresAt()));
        ctx.setVariable("giftCardsUrl", appProperties.frontendUrl() + "/gift-cards");

        send(userEmail, subject, "email/gift-card", ctx);
    }

    private String formatCurrency(java.math.BigDecimal amount) {
        return java.text.NumberFormat.getCurrencyInstance(new Locale("es", "AR"))
                .format(amount)
                .replace("ARS", "")
                .trim();
    }

    private String formatExpiryDate(java.time.Instant expiresAt) {
        java.time.ZonedDateTime zdt = expiresAt.atZone(java.time.ZoneId.of("America/Argentina/Buenos_Aires"));
        return zdt.format(java.time.format.DateTimeFormatter.ofPattern("dd 'de' MMMM 'de' yyyy", new Locale("es", "AR")));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Shared context pre-populated with the frontend URL for all templates. */
    private Context baseContext() {
        Context ctx = new Context(new Locale("es", "AR"));
        ctx.setVariable("appProperties.frontendUrl()", appProperties.frontendUrl());
        return ctx;
    }

    private boolean notConfigured() {
        return fromAddress == null || fromAddress.isBlank();
    }

    /**
     * Renders the Thymeleaf template and sends the email.
     *
     * @param to           recipient address
     * @param subject      email subject
     * @param templateName path relative to {@code src/main/resources/templates/} (no extension)
     * @param ctx          populated Thymeleaf context
     */
    private void send(String to, String subject, String templateName, Context ctx) {
        try {
            String html = templateEngine.process(templateName, ctx);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);

            mailSender.send(message);
            log.info("Email '{}' sent to {}", templateName, to);

        } catch (MessagingException e) {
            log.error("Failed to send '{}' to {}: {}", templateName, to, e.getMessage());
        }
    }

    // ── i18n helpers ──────────────────────────────────────────────────────────

    private String translateStatus(String status) {
        return switch (status.toLowerCase()) {
            case "pending"          -> "Pendiente";
            case "awaiting_payment" -> "Esperando pago";
            case "paid"             -> "Pago confirmado";
            case "preparing"        -> "En preparación";
            case "shipped"          -> "Enviado";
            case "delivered"        -> "Entregado";
            case "cancelled"        -> "Cancelado";
            case "refunded"         -> "Reembolsado";
            default                 -> status;
        };
    }

    private String statusIcon(String status) {
        return switch (status.toLowerCase()) {
            case "paid"      -> "✅";
            case "preparing" -> "🔧";
            case "shipped"   -> "🚚";
            case "delivered" -> "🎉";
            case "cancelled" -> "❌";
            case "refunded"  -> "💸";
            default          -> "📦";
        };
    }

    /** Returns emoji icon for return request statuses. Exposed as a bean for Thymeleaf. */
    public String statusIconForReturn(String status) {
        return switch (status.toUpperCase()) {
            case "APPROVED"    -> "✅";
            case "IN_PROGRESS" -> "🔄";
            case "COMPLETED"   -> "🎉";
            case "REJECTED"    -> "❌";
            case "PENDING"     -> "⏳";
            default            -> "📦";
        };
    }

    /** Returns human-readable label for loyalty point reasons. Exposed as a bean for Thymeleaf. */
    public String loyaltyReasonLabel(String reason) {
        if (reason == null) return "Puntos ganados";
        return switch (reason.toUpperCase()) {
            case "ORDER_DELIVERED"          -> "Pedido entregado";
            case "ORDER_REDEMPTION"         -> "Canje en checkout";
            case "REFERRAL_BONUS"           -> "Bono por referido (registro)";
            case "REFERRED_SIGNUP"          -> "Bonus de bienvenida";
            case "REFERRAL_FIRST_PURCHASE"  -> "Primera compra de tu referido";
            case "REVIEW"                   -> "Reseña publicada";
            case "BIRTHDAY"                 -> "Promoción de cumpleaños";
            case "PROMO"                    -> "Promoción especial";
            default                         -> "Puntos ganados";
        };
    }
}
