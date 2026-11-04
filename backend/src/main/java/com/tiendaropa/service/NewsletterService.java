package com.tiendaropa.service;

import com.tiendaropa.entity.NewsletterSubscriber;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.NewsletterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.internet.MimeMessage;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class NewsletterService {

    private final NewsletterRepository newsletterRepository;
    private final JavaMailSender mailSender;

    @Value("${app.mail.from-address:contacto@example.com}")
    private String mailFromAddress;

    @Value("${app.mail.from-name:Solder Studio}")
    private String mailFromName;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Transactional
    public NewsletterSubscriber subscribe(String email, String name) {
        String normalizedEmail = email.trim().toLowerCase();
        return newsletterRepository.findByEmail(normalizedEmail)
                .map(existing -> {
                    if (!existing.isActive()) {
                        existing.setActive(true);
                        if (name != null && !name.isBlank()) existing.setName(name.trim());
                        return newsletterRepository.save(existing);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    NewsletterSubscriber sub = NewsletterSubscriber.builder()
                            .email(normalizedEmail)
                            .name(name != null ? name.trim() : null)
                            .source("MANUAL")
                            .active(true)
                            .build();
                    return newsletterRepository.save(sub);
                });
    }

    @Transactional
    public void unsubscribe(String email) {
        newsletterRepository.findByEmail(email.trim().toLowerCase())
                .ifPresent(sub -> {
                    sub.setActive(false);
                    newsletterRepository.save(sub);
                });
    }

    @Transactional
    public void unsubscribeById(Long id) {
        newsletterRepository.findById(id).ifPresent(sub -> {
            sub.setActive(false);
            newsletterRepository.save(sub);
        });
    }

    @Transactional(readOnly = true)
    public Page<NewsletterSubscriber> listActive(Pageable pageable) {
        return newsletterRepository.findByActiveOrderBySubscribedAtDesc(true, pageable);
    }

    @Transactional(readOnly = true)
    public long countActive() {
        return newsletterRepository.countByActive(true);
    }

    @Async
    @Transactional(readOnly = true)
    public void sendCampaign(String subject, String htmlBody, String fromName) {
        List<NewsletterSubscriber> subscribers = newsletterRepository.findAllByActiveTrue();
        int total = subscribers.size();
        AtomicInteger sent = new AtomicInteger(0);
        AtomicInteger failed = new AtomicInteger(0);

        log.info("Sending newsletter campaign '{}' to {} subscribers", subject, total);

        for (NewsletterSubscriber sub : subscribers) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(sub.getEmail());
                helper.setSubject(subject);
                helper.setFrom(mailFromAddress, fromName != null ? fromName : mailFromName);

                String body = htmlBody + buildUnsubscribeFooter(sub.getEmail());
                helper.setText(body, true);
                mailSender.send(message);
                sent.incrementAndGet();
            } catch (Exception e) {
                log.error("Failed to send newsletter to {}: {}", sub.getEmail(), e.getMessage());
                failed.incrementAndGet();
            }
        }
        log.info("Newsletter campaign sent: {}/{} succeeded, {} failed", sent.get(), total, failed.get());
    }

    private String buildUnsubscribeFooter(String email) {
        return """
            <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
              <p>Recibiste este email porque estás suscripto a nuestro newsletter.</p>
              <p><a href="%s/unsubscribe?email=%s" style="color:#e020c8;">Desuscribirse</a></p>
            </div>
            """.formatted(frontendUrl, email);
    }
}
