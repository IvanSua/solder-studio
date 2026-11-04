package com.tiendaropa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.dto.response.EventResponse;
import com.tiendaropa.dto.response.ImportEventsResponse;
import com.tiendaropa.entity.Event;
import com.tiendaropa.repository.EventRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Imports events from the Ticketmaster Discovery API v2 into the local events table.
 *
 * Configuration:
 *   Set the environment variable TM_API_KEY with your Ticketmaster Consumer Key.
 *   Register free at: https://developer.ticketmaster.com/
 *
 * Deduplication:
 *   Two events are considered the same when their normalised title + eventDate match.
 *   If a duplicate is found and the new record has data the existing one is missing
 *   (imageUrl, ticketUrl, venue, eventTime) those fields are backfilled ("merge").
 *   If all fields are already populated the event is counted as "skipped".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventScraperService {

    private final EventRepository eventRepository;
    private final ObjectMapper    objectMapper;

    @Value("${events.ticketmaster.apikey:}")
    private String ticketmasterApiKey;

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    public ImportEventsResponse importEvents(LocalDate dateFrom, LocalDate dateTo) {
        List<ScrapedEvent> scraped = new ArrayList<>();
        List<String>       errors  = new ArrayList<>();

        safeCollect(scraped, errors, "Ticketmaster", () -> scrapeTicketmaster(dateFrom, dateTo));

        log.info("Ticketmaster: {} events found before dedup", scraped.size());

        int created = 0, merged = 0, skipped = 0;
        List<Event> affected = new ArrayList<>();

        for (ScrapedEvent dto : scraped) {
            Optional<Event> existing = findDuplicate(dto);
            if (existing.isPresent()) {
                Event ev = existing.get();
                if (mergeFields(ev, dto)) {
                    eventRepository.save(ev);
                    affected.add(ev);
                    merged++;
                } else {
                    skipped++;
                }
            } else {
                Event ev = toEntity(dto);
                eventRepository.save(ev);
                affected.add(ev);
                created++;
            }
        }

        log.info("Import complete — created:{} merged:{} skipped:{}", created, merged, skipped);

        return ImportEventsResponse.builder()
                .created(created)
                .merged(merged)
                .skipped(skipped)
                .events(affected.stream().map(EventResponse::from).toList())
                .errors(errors)
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Ticketmaster Discovery API v2
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Queries the Ticketmaster Discovery API for Music and Film events in Argentina.
     *
     * API docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
     * Free tier: 200 requests/day — more than enough for admin use.
     *
     * Returns up to 100 events per call sorted by date ascending.
     */
    private List<ScrapedEvent> scrapeTicketmaster(LocalDate from, LocalDate to) throws Exception {
        if (ticketmasterApiKey == null || ticketmasterApiKey.isBlank()) {
            throw new IllegalStateException(
                "API key de Ticketmaster no configurada. " +
                "Registrate en https://developer.ticketmaster.com/ y configurá " +
                "la variable de entorno TM_API_KEY con tu Consumer Key.");
        }

        String url = String.format(
            "https://app.ticketmaster.com/discovery/v2/events.json" +
            "?apikey=%s" +
            "&countryCode=AR" +
            "&classificationName=Music,Film" +
            "&startDateTime=%sT00:00:00Z" +
            "&endDateTime=%sT23:59:59Z" +
            "&size=100" +
            "&sort=date,asc",
            ticketmasterApiKey, from, to);

        RestTemplate rt = new RestTemplate();
        String json = rt.getForObject(url, String.class);
        if (json == null) return List.of();

        JsonNode root   = objectMapper.readTree(json);
        JsonNode events = root.path("_embedded").path("events");
        if (events.isMissingNode()) {
            log.info("Ticketmaster: no events found for AR in range {}/{}", from, to);
            return List.of();
        }

        List<ScrapedEvent> result = new ArrayList<>();
        for (JsonNode node : events) {
            try {
                String title   = node.path("name").asText();
                String dateStr = node.path("dates").path("start").path("localDate").asText();
                String timeStr = node.path("dates").path("start").path("localTime").asText();
                String ticketUrl = node.path("url").asText();

                LocalDate eventDate = LocalDate.parse(dateStr);
                if (eventDate.isBefore(from) || eventDate.isAfter(to)) continue;

                // Venue info
                JsonNode venueNode = node.path("_embedded").path("venues");
                String venue = "", city = "Buenos Aires";
                if (!venueNode.isEmpty()) {
                    venue = venueNode.get(0).path("name").asText("");
                    city  = venueNode.get(0).path("city").path("name").asText("Buenos Aires");
                }

                // Best image — prefer 16:9 ratio ≥ 640px wide
                String imageUrl = "";
                for (JsonNode img : node.path("images")) {
                    if ("16_9".equals(img.path("ratio").asText()) && img.path("width").asInt() >= 640) {
                        imageUrl = img.path("url").asText();
                        break;
                    }
                }
                if (imageUrl.isEmpty() && node.path("images").size() > 0) {
                    imageUrl = node.path("images").get(0).path("url").asText();
                }

                // Type from Ticketmaster classification
                String segment = "";
                JsonNode clf = node.path("classifications");
                if (!clf.isEmpty()) segment = clf.get(0).path("segment").path("name").asText();
                String type = "Film".equalsIgnoreCase(segment) ? "PREMIERE" : "CONCERT";

                LocalTime eventTime = null;
                if (!timeStr.isBlank()) {
                    try { eventTime = LocalTime.parse(timeStr); } catch (Exception ignored) {}
                }

                result.add(ScrapedEvent.builder()
                        .title(cleanTitle(title))
                        .type(type)
                        .category(detectCategory(title))
                        .eventDate(eventDate)
                        .eventTime(eventTime)
                        .venue(nullIfEmpty(venue))
                        .city(city)
                        .imageUrl(nullIfEmpty(imageUrl))
                        .ticketUrl(nullIfEmpty(ticketUrl))
                        .build());

            } catch (Exception e) {
                log.debug("Ticketmaster: error parsing event — {}", e.getMessage());
            }
        }

        log.info("Ticketmaster: {} events parsed", result.size());
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Deduplication
    // ──────────────────────────────────────────────────────────────────────────

    private Optional<Event> findDuplicate(ScrapedEvent dto) {
        String normalised = normalise(dto.getTitle());
        return eventRepository
                .findByEventDate(dto.getEventDate())
                .stream()
                .filter(e -> normalise(e.getTitle()).equals(normalised))
                .findFirst();
    }

    /** Backfill null fields from the new record. Returns true if anything changed. */
    private boolean mergeFields(Event existing, ScrapedEvent dto) {
        boolean changed = false;
        if (existing.getImageUrl()  == null && dto.getImageUrl()  != null) { existing.setImageUrl(dto.getImageUrl());   changed = true; }
        if (existing.getTicketUrl() == null && dto.getTicketUrl() != null) { existing.setTicketUrl(dto.getTicketUrl()); changed = true; }
        if (existing.getVenue()     == null && dto.getVenue()     != null) { existing.setVenue(dto.getVenue());         changed = true; }
        if (existing.getEventTime() == null && dto.getEventTime() != null) { existing.setEventTime(dto.getEventTime()); changed = true; }
        return changed;
    }

    private Event toEntity(ScrapedEvent dto) {
        return Event.builder()
                .title(dto.getTitle())
                .type(dto.getType()     != null ? dto.getType()     : "CONCERT")
                .category(dto.getCategory() != null ? dto.getCategory() : "OTHER")
                .eventDate(dto.getEventDate())
                .eventTime(dto.getEventTime())
                .venue(dto.getVenue())
                .city(dto.getCity()     != null ? dto.getCity()     : "Buenos Aires")
                .imageUrl(dto.getImageUrl())
                .ticketUrl(dto.getTicketUrl())
                .active(true)
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Map event title keywords to music/film categories */
    private String detectCategory(String title) {
        String t = title.toLowerCase(Locale.ROOT);
        if (t.contains("bts")    || t.contains("k-pop")   || t.contains("blackpink") || t.contains("kpop"))         return "POP";
        if (t.contains("ac/dc")  || t.contains("acdc")    || t.contains("metallica")
                || t.contains("iron maiden") || t.contains("slipknot"))                                             return "METAL";
        if (t.contains("maluma") || t.contains("chayanne") || t.contains("j balvin") || t.contains("latin"))        return "LATIN";
        if (t.contains("anime")  || t.contains("naruto")  || t.contains("dragon ball")
                || t.contains("attack on titan") || t.contains("one piece"))                                        return "ANIME";
        if (t.contains("marvel") || t.contains("avengers") || t.contains("spider-man"))                             return "MARVEL";
        if (t.contains("disney") || t.contains("pixar")   || t.contains("frozen"))                                  return "DISNEY";
        if (t.contains("rock")   || t.contains("stones")  || t.contains("foo fighters"))                            return "ROCK";
        return "OTHER";
    }

    /** Normalise a title for dedup: lowercase, no accents, no punctuation, collapsed spaces */
    private String normalise(String s) {
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("[áàä]", "a").replaceAll("[éèë]", "e")
                .replaceAll("[íìï]", "i").replaceAll("[óòö]", "o")
                .replaceAll("[úùü]", "u").replaceAll("ñ", "n")
                .replaceAll("[^a-z0-9 ]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String cleanTitle(String s)  { return s.replaceAll("\\s+", " ").trim(); }
    private String nullIfEmpty(String s) { return (s == null || s.isBlank()) ? null : s; }

    private void safeCollect(List<ScrapedEvent> target, List<String> errors,
                             String label, CheckedSupplier<List<ScrapedEvent>> supplier) {
        try {
            List<ScrapedEvent> found = supplier.get();
            log.info("{}: {} events scraped", label, found.size());
            target.addAll(found);
        } catch (Exception e) {
            log.warn("{}: scraping failed — {}", label, e.getMessage());
            errors.add(e.getMessage());
        }
    }

    @FunctionalInterface
    private interface CheckedSupplier<T> {
        T get() throws Exception;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal DTO
    // ──────────────────────────────────────────────────────────────────────────

    @Data
    @Builder
    private static class ScrapedEvent {
        String    title;
        String    type;
        String    category;
        LocalDate eventDate;
        LocalTime eventTime;
        String    venue;
        String    city;
        String    imageUrl;
        String    ticketUrl;
    }
}
