package com.tiendaropa.dto.response;

import com.tiendaropa.entity.Event;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class EventResponse {

    private Long      id;
    private String    title;
    private String    subtitle;
    private String    type;
    private String    category;
    private LocalDate eventDate;
    private LocalTime eventTime;
    private String    venue;
    private String    city;
    private String    description;
    private String    imageUrl;
    private String    ticketUrl;
    private boolean   active;

    public static EventResponse from(Event e) {
        EventResponse r = new EventResponse();
        r.setId(e.getId());
        r.setTitle(e.getTitle());
        r.setSubtitle(e.getSubtitle());
        r.setType(e.getType());
        r.setCategory(e.getCategory());
        r.setEventDate(e.getEventDate());
        r.setEventTime(e.getEventTime());
        r.setVenue(e.getVenue());
        r.setCity(e.getCity());
        r.setDescription(e.getDescription());
        r.setImageUrl(e.getImageUrl());
        r.setTicketUrl(e.getTicketUrl());
        r.setActive(e.isActive());
        return r;
    }
}
