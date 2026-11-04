package com.tiendaropa.controller;

import com.tiendaropa.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Serves /sitemap.xml and /robots.txt at the root path (no /api prefix).
 *
 * Security: both endpoints are PUBLIC — configured in SecurityConfig to permit all.
 */
@RestController
@RequiredArgsConstructor
public class SitemapController {

    private static final DateTimeFormatter W3C_DATE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

    private final ProductRepository productRepository;

    @Value("${app.frontend.url:https://solderstudio.com.ar}")
    private String frontendUrl;

    // ── /sitemap.xml ─────────────────────────────────────────────────────────

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        List<Object[]> products = productRepository.findAllActiveSlugsWithDate();

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // Static pages
        appendUrl(xml, frontendUrl + "/",             today(), "weekly",  "1.0");
        appendUrl(xml, frontendUrl + "/sugerencias",  today(), "weekly",  "0.6");

        // Dynamic product pages
        for (Object[] row : products) {
            String slug       = (String) row[0];
            Instant updatedAt = (Instant) row[1];
            String lastmod    = updatedAt != null ? W3C_DATE.format(updatedAt) : today();
            appendUrl(xml, frontendUrl + "/product/" + slug, lastmod, "weekly", "0.8");
        }

        xml.append("</urlset>");

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.toString());
    }

    // ── /robots.txt ───────────────────────────────────────────────────────────

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robots() {
        String body = """
                User-agent: *
                Allow: /
                Disallow: /admin
                Disallow: /worker
                Disallow: /api/
                Disallow: /auth
                Disallow: /cart
                Disallow: /checkout
                Disallow: /orders
                Disallow: /profile
                Disallow: /designs

                Sitemap: %s/sitemap.xml
                """.formatted(frontendUrl);

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(body);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private void appendUrl(StringBuilder sb, String loc, String lastmod,
                           String changefreq, String priority) {
        sb.append("  <url>\n");
        sb.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
        sb.append("    <lastmod>").append(lastmod).append("</lastmod>\n");
        sb.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        sb.append("    <priority>").append(priority).append("</priority>\n");
        sb.append("  </url>\n");
    }

    private String escapeXml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String today() {
        return W3C_DATE.format(Instant.now());
    }
}
