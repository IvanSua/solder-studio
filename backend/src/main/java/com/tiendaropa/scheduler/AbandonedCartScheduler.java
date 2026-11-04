package com.tiendaropa.scheduler;

import com.tiendaropa.entity.Cart;
import com.tiendaropa.repository.CartRepository;
import com.tiendaropa.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Runs every hour and sends a single reminder email to users whose cart has had
 * items sitting untouched for more than {@link #HOURS_BEFORE_REMINDER} hours.
 *
 * To avoid spam, the reminder is only sent once per cart per 48-hour window
 * (tracked by {@code Cart.lastAbandonedEmailAt}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AbandonedCartScheduler {

    /** Cart must be idle for at least this many hours before we send a reminder. */
    private static final int HOURS_BEFORE_REMINDER = 24;

    private final CartRepository cartRepository;
    private final EmailService emailService;

    /**
     * Runs every hour at the top of the hour.
     * cron: "0 0 * * * *" → second=0, minute=0, every hour.
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void processAbandonedCarts() {
        Instant cutoff = Instant.now().minus(HOURS_BEFORE_REMINDER, ChronoUnit.HOURS);
        List<Cart> abandoned = cartRepository.findAbandonedCarts(cutoff);

        if (abandoned.isEmpty()) {
            return;
        }
        log.info("Abandoned cart job: {} cart(s) eligible for reminder", abandoned.size());

        for (Cart cart : abandoned) {
            var user = cart.getUser();
            if (user == null || user.getEmail() == null) continue;

            int itemCount = cart.getItems().size();
            emailService.sendAbandonedCartEmail(user.getEmail(), user.getFirstName(), itemCount);

            // Record send time so we don't re-send until the next 48-hour window
            cart.setLastAbandonedEmailAt(Instant.now());
            cartRepository.save(cart);
        }
    }
}
