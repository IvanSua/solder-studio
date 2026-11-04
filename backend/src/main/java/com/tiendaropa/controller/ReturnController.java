package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CreateReturnRequest;
import com.tiendaropa.dto.response.ReturnRequestResponse;
import com.tiendaropa.service.ReturnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Customer-facing endpoints for managing return requests.
 *
 * POST   /api/returns            — submit a new return request
 * GET    /api/returns            — list my return requests
 * GET    /api/returns/{id}       — get a single return request
 */
@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
public class ReturnController {

    private final ReturnService returnService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReturnRequestResponse create(Authentication auth,
                                        @Valid @RequestBody CreateReturnRequest req) {
        return returnService.create((Long) auth.getPrincipal(), req);
    }

    @GetMapping
    public List<ReturnRequestResponse> list(Authentication auth) {
        return returnService.getMyReturns((Long) auth.getPrincipal());
    }

    @GetMapping("/{id}")
    public ReturnRequestResponse get(Authentication auth, @PathVariable Long id) {
        return returnService.getMyReturn((Long) auth.getPrincipal(), id);
    }
}
