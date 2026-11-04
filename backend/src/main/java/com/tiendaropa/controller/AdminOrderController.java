package com.tiendaropa.controller;

import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final OrderService orderService;
    private final OrderRepository orderRepository;

    /**
     * List all orders with optional filtering.
     * @param status filter by OrderStatus enum value (e.g. PAID, SHIPPED) — null means all
     * @param q      search by customer name, email, or order ID
     */
    @GetMapping
    public Page<OrderResponse> listAll(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        boolean hasFilters = status != null || (q != null && !q.isBlank());
        return hasFilters
                ? orderService.getAllOrdersFiltered(status, q, pageable)
                : orderService.getAllOrders(pageable);
    }

    /** Get a single order by id (admin can see any order) */
    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return orderService.getOrderByIdAdmin(id);
    }

    /**
     * Update the status of an order.
     * Body: { "status": "SHIPPED" }
     */
    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable Long id,
                                      @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        if (statusStr == null || statusStr.isBlank()) {
            throw new BusinessException("'status' field is required", HttpStatus.BAD_REQUEST);
        }
        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(statusStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid status: " + statusStr, HttpStatus.BAD_REQUEST);
        }
        return orderService.updateOrderStatus(id, newStatus);
    }

    /** Mark a DELIVERED or PAID order as REFUNDED */
    @PostMapping("/{id}/refund")
    public OrderResponse refund(@PathVariable Long id) {
        return orderService.refundOrder(id);
    }

    /**
     * Update (or clear) internal admin notes on an order.
     * Body: { "notes": "Customer requested gift wrap" }
     */
    @PatchMapping("/{id}/notes")
    public OrderResponse updateNotes(@PathVariable Long id,
                                     @RequestBody Map<String, String> body) {
        return orderService.updateNotes(id, body.get("notes"));
    }

    /**
     * Set (or clear) tracking information for an order.
     * Body: { "trackingNumber": "OCA123456", "trackingUrl": "https://..." }
     */
    @PatchMapping("/{id}/tracking")
    public OrderResponse updateTracking(@PathVariable Long id,
                                        @RequestBody Map<String, String> body) {
        String trackingNumber = body.get("trackingNumber");
        String trackingUrl    = body.get("trackingUrl");
        return orderService.updateTracking(id, trackingNumber, trackingUrl);
    }
}
