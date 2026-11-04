package com.tiendaropa.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Serves static legal pages (Privacy Policy, Terms & Conditions).
 * These are rendered as Thymeleaf templates for SEO.
 */
@Controller
@RequestMapping("/legal")
@Tag(name = "Legal", description = "Legal pages")
public class LegalController {

    @GetMapping(value = "/privacy", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Privacy Policy", description = "Returns the privacy policy page")
    public String privacyPolicy() {
        return "legal/privacy";
    }

    @GetMapping(value = "/terms", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Terms & Conditions", description = "Returns the terms and conditions page")
    public String termsAndConditions() {
        return "legal/terms";
    }
}
