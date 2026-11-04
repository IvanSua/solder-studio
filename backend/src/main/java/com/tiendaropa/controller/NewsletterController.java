package com.tiendaropa.controller;

import com.tiendaropa.entity.NewsletterSubscriber;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.service.NewsletterService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/newsletter")
@RequiredArgsConstructor
public class NewsletterController {

    private final NewsletterService newsletterService;

    /** Public: subscribe */
    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> subscribe(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String name  = body.get("name");
        if (email == null || !email.contains("@")) {
            throw new BusinessException("Email inválido", HttpStatus.BAD_REQUEST);
        }
        newsletterService.subscribe(email, name);
        return Map.of("message", "Suscripción exitosa");
    }

    /** Public: unsubscribe via link */
    @PostMapping("/unsubscribe")
    public Map<String, String> unsubscribe(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email != null) newsletterService.unsubscribe(email);
        return Map.of("message", "Desuscripción exitosa");
    }

    /** Admin: list subscribers with pagination */
    @GetMapping("/admin/subscribers")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<NewsletterSubscriber> listSubscribers(
            @RequestParam(defaultValue = "true") boolean active,
            @PageableDefault(size = 10) Pageable pageable) {
        return newsletterService.listActive(pageable);
    }

    /** Admin: count active subscribers */
    @GetMapping("/admin/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Long> stats() {
        return Map.of("activeSubscribers", newsletterService.countActive());
    }

    /** Admin: send campaign */
    @PostMapping("/admin/send-campaign")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> sendCampaign(@RequestBody Map<String, String> body) {
        String subject  = body.get("subject");
        String htmlBody = body.get("body");
        String fromName = body.getOrDefault("fromName", "Tienda de Ropa");
        if (subject == null || subject.isBlank()) {
            throw new BusinessException("El asunto no puede estar vacío", HttpStatus.BAD_REQUEST);
        }
        if (htmlBody == null || htmlBody.isBlank()) {
            throw new BusinessException("El cuerpo no puede estar vacío", HttpStatus.BAD_REQUEST);
        }
        newsletterService.sendCampaign(subject, htmlBody, fromName);
        return Map.of("message", "Campaña enviada a todos los suscriptores activos");
    }

    /** Admin: unsubscribe a specific subscriber by id */
    @PostMapping("/admin/unsubscribe/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> adminUnsubscribeById(@PathVariable Long id) {
        newsletterService.unsubscribeById(id);
        return Map.of("message", "Desuscripto exitosamente");
    }
}
