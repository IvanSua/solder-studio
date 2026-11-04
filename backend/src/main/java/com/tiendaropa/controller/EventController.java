package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CreateEventRequest;
import com.tiendaropa.dto.request.ImportEventsRequest;
import com.tiendaropa.dto.response.EventResponse;
import com.tiendaropa.dto.response.ImportEventsResponse;
import com.tiendaropa.entity.Event;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.EventRepository;
import com.tiendaropa.service.EventScraperService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Event endpoints.
 *
 * Public:
 *   GET  /api/v1/events           — upcoming active events (from today onward)
 *   GET  /api/v1/events/range     — active events in ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Admin (requires ADMIN role via SecurityConfig /api/admin/** rule):
 *   GET    /api/v1/admin/events         — all events (incl. inactive)
 *   POST   /api/v1/admin/events         — create event
 *   PUT    /api/v1/admin/events/{id}    — update event
 *   DELETE /api/v1/admin/events/{id}    — delete event
 */
@RestController
@RequiredArgsConstructor
public class EventController {

    private final EventRepository   eventRepository;
    private final EventScraperService scraperService;

    // ── Public ────────────────────────────────────────────────────────────────

    @GetMapping("/api/v1/events")
    public List<EventResponse> upcoming() {
        return eventRepository
                .findByActiveTrueAndEventDateGreaterThanEqualOrderByEventDateAsc(LocalDate.now())
                .stream().map(EventResponse::from).toList();
    }

    @GetMapping("/api/v1/events/range")
    public List<EventResponse> inRange(
            @RequestParam String from,
            @RequestParam String to) {
        LocalDate f = LocalDate.parse(from);
        LocalDate t = LocalDate.parse(to);
        return eventRepository.findActiveInRange(f, t)
                .stream().map(EventResponse::from).toList();
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    @GetMapping("/api/v1/admin/events")
    public List<EventResponse> adminList() {
        return eventRepository.findAll(Sort.by(Sort.Direction.DESC, "eventDate"))
                .stream().map(EventResponse::from).toList();
    }

    @PostMapping("/api/v1/admin/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@Valid @RequestBody CreateEventRequest req) {
        Event e = Event.builder()
                .title(req.getTitle())
                .subtitle(req.getSubtitle())
                .type(req.getType())
                .category(req.getCategory())
                .eventDate(req.getEventDate())
                .eventTime(req.getEventTime())
                .venue(req.getVenue())
                .city(req.getCity() != null ? req.getCity() : "Buenos Aires")
                .description(req.getDescription())
                .imageUrl(req.getImageUrl())
                .ticketUrl(req.getTicketUrl())
                .active(req.isActive())
                .build();
        return EventResponse.from(eventRepository.save(e));
    }

    @PutMapping("/api/v1/admin/events/{id}")
    public EventResponse update(@PathVariable Long id,
                                @Valid @RequestBody CreateEventRequest req) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        e.setTitle(req.getTitle());
        e.setSubtitle(req.getSubtitle());
        e.setType(req.getType());
        e.setCategory(req.getCategory());
        e.setEventDate(req.getEventDate());
        e.setEventTime(req.getEventTime());
        e.setVenue(req.getVenue());
        e.setCity(req.getCity() != null ? req.getCity() : "Buenos Aires");
        e.setDescription(req.getDescription());
        e.setImageUrl(req.getImageUrl());
        e.setTicketUrl(req.getTicketUrl());
        e.setActive(req.isActive());
        return EventResponse.from(eventRepository.save(e));
    }

    @DeleteMapping("/api/v1/admin/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        eventRepository.delete(e);
    }

    /**
     * POST /api/v1/admin/events/import
     *
     * Queries Ticketmaster Discovery API for the given date range and
     * imports events with smart deduplication / field merging.
     *
     * Requires TM_API_KEY environment variable (free at developer.ticketmaster.com).
     *
     * Body: { "dateFrom": "2026-05-01", "dateTo": "2026-08-31" }
     */
    @PostMapping("/api/v1/admin/events/import")
    public ImportEventsResponse importEvents(@Valid @RequestBody ImportEventsRequest req) {
        return scraperService.importEvents(req.getDateFrom(), req.getDateTo());
    }
}
