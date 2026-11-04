package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class CreateEventRequest {

    @NotBlank
    private String    title;
    private String    subtitle;

    @NotBlank
    private String    type;      // CONCERT | PREMIERE | OTHER
    private String    category;  // ROCK | POP | METAL | LATIN | DISNEY | ANIME | MARVEL | OTHER

    @NotNull
    private LocalDate eventDate;
    private LocalTime eventTime;
    private String    venue;
    private String    city;
    private String    description;
    private String    imageUrl;
    private String    ticketUrl;
    private boolean   active = true;
}
