package com.tiendaropa.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ImportEventsRequest {

    @NotNull
    private LocalDate dateFrom;

    @NotNull
    private LocalDate dateTo;
}
