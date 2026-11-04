package com.tiendaropa.controller;

import com.tiendaropa.dto.response.ReturnRequestResponse;
import com.tiendaropa.enums.ReturnStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.service.ReturnService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only endpoints for managing return requests.
 *
 * GET    /api/admin/returns              — paginated list (optional ?status=PENDING)
 * GET    /api/admin/returns/{id}         — single return detail
 * PATCH  /api/admin/returns/{id}         — update status and/or admin notes
 */
@RestController
@RequestMapping("/api/v1/admin/returns")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminReturnController {

    private final ReturnService returnService;

    @GetMapping
    public Page<ReturnRequestResponse> list(
            @RequestParam(required = false) ReturnStatus status,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return returnService.adminList(status, pageable);
    }

    @GetMapping("/{id}")
    public ReturnRequestResponse get(@PathVariable Long id) {
        return returnService.adminGet(id);
    }

    /**
     * Patch body: {@code { "status": "APPROVED", "adminNotes": "...", "refundAmount": "123456" }}
     * All fields are optional — send only what you want to update.
     */
    @PatchMapping("/{id}")
    public ReturnRequestResponse update(@PathVariable Long id,
                                        @RequestBody Map<String, String> patch) {
        return returnService.adminUpdate(id, patch);
    }

    /**
     * Issue a (partial) monetary refund via the payment provider.
     *
     * Body: {@code { "amount": 123456 }}  — amount in centavos (ARS).
     * Only applicable when the original order was paid via MercadoPago.
     * Idempotent guard: returns 409 if already processed.
     */
    @PostMapping("/{id}/refund")
    public ReturnRequestResponse issueRefund(@PathVariable Long id,
                                             @RequestBody Map<String, Long> body) {
        Long amount = body.get("amount");
        if (amount == null) {
            throw new BusinessException("'amount' field is required (centavos)", HttpStatus.BAD_REQUEST);
        }
        return returnService.processRefund(id, amount);
    }
}
