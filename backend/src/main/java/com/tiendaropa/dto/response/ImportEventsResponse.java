package com.tiendaropa.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ImportEventsResponse {

    /** Events created (new, not found in DB) */
    private int created;

    /** Events that existed but were enriched with missing data from the new source */
    private int merged;

    /** Events that already existed with identical data — no changes needed */
    private int skipped;

    /** All events that were created or merged (for the frontend preview) */
    private List<EventResponse> events;

    /** Non-fatal errors per source (e.g. site unreachable) */
    private List<String> errors;
}
