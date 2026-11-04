package com.tiendaropa.controller;

import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.service.InvoiceService;
import com.tiendaropa.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final InvoiceService invoiceService;

    @GetMapping
    public Page<OrderResponse> list(Authentication auth, Pageable pageable) {
        return orderService.getUserOrders((Long) auth.getPrincipal(), pageable);
    }

    @GetMapping("/{id}")
    public OrderResponse get(Authentication auth, @PathVariable Long id) {
        return orderService.getOrder((Long) auth.getPrincipal(), id);
    }

    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(Authentication auth, @PathVariable Long id) {
        return orderService.cancelOrder((Long) auth.getPrincipal(), id);
    }

    /** Download a PDF invoice/receipt for the given order. */
    @GetMapping("/{id}/invoice")
    public ResponseEntity<byte[]> invoice(Authentication auth, @PathVariable Long id) {
        byte[] pdf = invoiceService.generate((Long) auth.getPrincipal(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"comprobante-pedido-" + id + ".pdf\"")
                .body(pdf);
    }
}
