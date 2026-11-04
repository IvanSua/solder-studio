package com.tiendaropa.controller;

import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.entity.DesignAsset;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CustomDesignRepository;
import com.tiendaropa.service.OrderService;
import com.tiendaropa.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Dedicated endpoints for WORKER role — only the operational subset of actions.
 * Workers can advance orders through the production flow and download design assets.
 * Financial operations (refunds, pricing) remain admin-only.
 */
@RestController
@RequestMapping("/api/v1/worker/orders")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'WORKER')")
public class WorkerOrderController {

    private static final List<OrderStatus> WORKER_VISIBLE_STATUSES =
            List.of(OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED);

    private static final Map<OrderStatus, OrderStatus> ALLOWED_TRANSITIONS = Map.of(
            OrderStatus.PAID,      OrderStatus.PREPARING,
            OrderStatus.PREPARING, OrderStatus.SHIPPED,
            OrderStatus.SHIPPED,   OrderStatus.DELIVERED
    );

    private final OrderService orderService;
    private final CustomDesignRepository designRepository;
    private final StorageService storageService;

    /**
     * List orders visible to workers: paid, preparing, shipped.
     * Optional ?all=true includes delivered orders too (for history).
     */
    @GetMapping
    public Page<OrderResponse> list(
            @RequestParam(defaultValue = "false") boolean all,
            @RequestParam(defaultValue = "0")     int page,
            @RequestParam(defaultValue = "20")    int size) {

        // Workers see operational queue by default; ?all=true includes delivered
        OrderStatus statusFilter = all ? null : null; // we use multi-status filtering below
        return all
                ? orderService.getAllOrders(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                : orderService.getOrdersByStatuses(
                        WORKER_VISIBLE_STATUSES,
                        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    /**
     * Advance an order to the next status in the operational flow.
     * Body (JSON):
     *   { "trackingNumber": "OCA123456", "trackingUrl": "https://..." }  — required when advancing to SHIPPED
     */
    @PatchMapping("/{id}/advance")
    public OrderResponse advance(@PathVariable Long id,
                                 @RequestBody(required = false) Map<String, String> body) {
        OrderResponse current = orderService.getOrderByIdAdmin(id);

        OrderStatus currentStatus;
        try {
            currentStatus = OrderStatus.valueOf(current.getStatus().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Unknown current status: " + current.getStatus(), HttpStatus.CONFLICT);
        }

        OrderStatus nextStatus = ALLOWED_TRANSITIONS.get(currentStatus);
        if (nextStatus == null) {
            throw new BusinessException(
                    "Order #" + id + " is in status " + currentStatus + " — no further worker transitions allowed.",
                    HttpStatus.CONFLICT);
        }

        // Tracking is required when marking as shipped
        if (nextStatus == OrderStatus.SHIPPED) {
            String trackingNumber = body != null ? body.get("trackingNumber") : null;
            if (trackingNumber == null || trackingNumber.isBlank()) {
                throw new BusinessException(
                        "trackingNumber is required when advancing to SHIPPED", HttpStatus.BAD_REQUEST);
            }
            String trackingUrl = body != null ? body.get("trackingUrl") : null;
            orderService.updateTracking(id, trackingNumber, trackingUrl);
        }

        return orderService.updateOrderStatus(id, nextStatus);
    }

    /**
     * Returns a pre-signed download URL for each asset in a custom design.
     * Used by workers to download the customer's uploaded artwork before production.
     */
    @GetMapping("/{orderId}/designs/{designId}/assets")
    public List<DesignAssetDownload> getDesignAssets(@PathVariable Long orderId,
                                                     @PathVariable Long designId) {
        // Verify the order exists (admin view — worker can see any order)
        orderService.getOrderByIdAdmin(orderId);

        CustomDesign design = designRepository.findById(designId)
                .orElseThrow(() -> new ResourceNotFoundException("Custom design not found: " + designId));

        return design.getAssets().stream()
                .map(asset -> new DesignAssetDownload(
                        asset.getId(),
                        asset.getSortOrder(),
                        asset.getMimeType(),
                        asset.getWidthPx(),
                        asset.getHeightPx(),
                        resolveUrl(asset.getNormalizedFileUrl()),
                        resolveUrl(asset.getOriginalFileUrl())
                ))
                .toList();
    }

    private String resolveUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) return storedUrl;
        try { return storageService.getPresignedUrl(storedUrl); } catch (Exception e) { return storedUrl; }
    }

    public record DesignAssetDownload(
            Long assetId,
            int sortOrder,
            String mimeType,
            int widthPx,
            int heightPx,
            String normalizedUrl,
            String originalUrl
    ) {}
}
