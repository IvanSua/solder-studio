package com.tiendaropa.service;

import com.tiendaropa.dto.response.OrderResponse;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.OrderItem;
import com.tiendaropa.entity.ProductImage;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final Set<OrderStatus> CANCELLABLE_STATUSES =
            EnumSet.of(OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT);

    private final OrderRepository orderRepository;
    private final ProductVariantRepository variantRepository;
    private final StorageService storageService;
    private final EmailService emailService;
    private final PointsService pointsService;
    private final NotificationService notificationService;
    private final BusinessMetricsService metrics;

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return mapToResponse(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getUserOrders(Long userId, Pageable pageable) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::mapToResponse);
    }

    /**
     * Allows the authenticated customer to cancel their own order.
     * Only PENDING and AWAITING_PAYMENT orders may be cancelled.
     * Reserved stock is released back to available on cancellation.
     */
    @Transactional
    public OrderResponse cancelOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (!CANCELLABLE_STATUSES.contains(order.getStatus())) {
            throw new BusinessException(
                    "Order cannot be cancelled in status: " + order.getStatus(),
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Release reserved stock for each item
        for (OrderItem item : order.getItems()) {
            ProductVariant variant = item.getProductVariant();
            if (variant != null) {
                int toRelease = Math.min(item.getQuantity(), variant.getStockReserved());
                variant.setStockReserved(variant.getStockReserved() - toRelease);
                variantRepository.save(variant);
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        return mapToResponse(orderRepository.save(order));
    }

    // ── Admin methods ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<OrderResponse> getAllOrders(Pageable pageable) {
        return orderRepository.findAll(pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getOrdersByStatuses(List<OrderStatus> statuses, Pageable pageable) {
        return orderRepository.findByStatusInOrderByCreatedAtDesc(statuses, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getAllOrdersFiltered(OrderStatus status, String q, Pageable pageable) {
        String search = (q != null && q.isBlank()) ? null : q;
        return orderRepository.findFiltered(status, search, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderByIdAdmin(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        return mapToResponse(order);
    }

    @Transactional
    public OrderResponse updateOrderStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        order.setStatus(newStatus);
        Order saved = orderRepository.save(order);

        // Notify customer asynchronously
        User user = saved.getUser();
        if (user != null) {
            emailService.sendOrderStatusUpdate(
                    saved.getId(),
                    newStatus.name().toLowerCase(),
                    user.getEmail(),
                    user.getFirstName());

            // In-app notification
            String[] notifInfo = buildStatusNotification(newStatus, saved.getId());
            notificationService.createAsync(
                    user.getId(),
                    resolveNotificationType(newStatus),
                    notifInfo[0],
                    notifInfo[1],
                    "/orders/" + saved.getId());
        }

        metrics.orderStatusChanged(newStatus.name());

        // Award loyalty points when order is delivered (1 pt per $100 ARS)
        if (newStatus == OrderStatus.DELIVERED && user != null) {
            pointsService.awardOrderPoints(user.getId(), saved.getId(), saved.getTotalAmount());

            // ── Referral first-purchase bonus ──────────────────────────────────
            // If this is the buyer's first delivered order and they were referred,
            // award the referrer 300 pts.
            User referrer = user.getReferredBy();
            if (referrer != null) {
                long deliveredCount = orderRepository.countByUserIdAndStatus(
                        user.getId(), OrderStatus.DELIVERED);
                if (deliveredCount == 1) {
                    pointsService.awardPoints(
                            referrer.getId(),
                            300,
                            "REFERRAL_FIRST_PURCHASE",
                            saved.getId());
                    log.info("Referral first-purchase bonus: 300 pts awarded to user {} for referring user {}",
                            referrer.getId(), user.getId());
                    metrics.referralBonusAwarded("FIRST_PURCHASE");
                }
            }
        }

        return mapToResponse(saved);
    }

    @Transactional
    public OrderResponse refundOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        if (order.getStatus() != OrderStatus.DELIVERED && order.getStatus() != OrderStatus.PAID) {
            throw new BusinessException(
                    "Only DELIVERED or PAID orders can be refunded",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        order.setStatus(OrderStatus.REFUNDED);
        Order saved = orderRepository.save(order);
        User user = saved.getUser();
        if (user != null) {
            emailService.sendOrderStatusUpdate(
                    saved.getId(), "refunded", user.getEmail(), user.getFirstName());
            notificationService.createAsync(
                    user.getId(),
                    NotificationType.ORDER_REFUNDED,
                    "Reembolso procesado",
                    "Tu pedido #" + saved.getId() + " ha sido reembolsado.",
                    "/orders/" + saved.getId());
        }
        return mapToResponse(saved);
    }

    // ── Notification helpers ─────────────────────────────────────────────────

    private NotificationType resolveNotificationType(OrderStatus status) {
        return switch (status) {
            case SHIPPED   -> NotificationType.ORDER_SHIPPED;
            case DELIVERED -> NotificationType.ORDER_DELIVERED;
            case CANCELLED -> NotificationType.ORDER_CANCELLED;
            default        -> NotificationType.ORDER_STATUS_CHANGE;
        };
    }

    private String[] buildStatusNotification(OrderStatus status, Long orderId) {
        String title = switch (status) {
            case PAID             -> "Pago confirmado";
            case PREPARING        -> "Pedido en preparación";
            case SHIPPED          -> "¡Tu pedido está en camino!";
            case DELIVERED        -> "¡Pedido entregado!";
            case CANCELLED        -> "Pedido cancelado";
            case AWAITING_PAYMENT -> "Esperando pago";
            default               -> "Actualización de pedido";
        };
        String message = switch (status) {
            case PAID             -> "Recibimos el pago de tu pedido #" + orderId + ".";
            case PREPARING        -> "Tu pedido #" + orderId + " está siendo preparado.";
            case SHIPPED          -> "Tu pedido #" + orderId + " fue despachado y está en camino.";
            case DELIVERED        -> "Tu pedido #" + orderId + " fue entregado. ¡Gracias!";
            case CANCELLED        -> "Tu pedido #" + orderId + " fue cancelado.";
            case AWAITING_PAYMENT -> "Tu pedido #" + orderId + " está esperando el pago.";
            default               -> "El estado de tu pedido #" + orderId + " cambió a " + status.name().toLowerCase() + ".";
        };
        return new String[]{title, message};
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private OrderResponse.OrderItemResponse mapItem(OrderItem item) {
        var variant = item.getProductVariant();
        var product = variant != null ? variant.getProduct() : null;

        String productSlug = product != null ? product.getSlug() : null;
        String imageUrl = null;
        if (product != null && product.getImages() != null) {
            Optional<ProductImage> img = product.getImages().stream()
                    .filter(ProductImage::isPrimary).findFirst();
            if (img.isEmpty() && !product.getImages().isEmpty()) {
                img = Optional.of(product.getImages().get(0));
            }
            if (img.isPresent()) {
                imageUrl = resolveImageUrl(img.get().getImageUrl());
            }
        }

        return OrderResponse.OrderItemResponse.builder()
                .productVariantId(variant != null ? variant.getId() : null)
                .productName(item.getProductName())
                .productSlug(productSlug)
                .imageUrl(imageUrl)
                .color(item.getVariantColor())
                .size(item.getVariantSize())
                .quantity(item.getQuantity())
                .unitPrice(item.getUnitPriceAmount())
                .customDesignId(item.getCustomDesign() != null ? item.getCustomDesign().getId() : null)
                .build();
    }

    private String resolveImageUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) return storedUrl;
        try {
            return storageService.getPresignedUrl(storedUrl);
        } catch (Exception e) {
            return storedUrl;
        }
    }

    private OrderResponse mapToResponse(Order order) {
        var items = order.getItems().stream()
                .map(this::mapItem)
                .toList();

        OrderResponse.ShippingAddress shippingAddr = null;
        if (order.getShippingAddress() != null) {
            var addr = order.getShippingAddress();
            shippingAddr = OrderResponse.ShippingAddress.builder()
                    .street(addr.getStreet())
                    .apartment(addr.getApartment())
                    .city(addr.getCity())
                    .province(addr.getProvince())
                    .postalCode(addr.getPostalCode())
                    .build();
        }

        String customerEmail = null;
        String customerName = null;
        if (order.getUser() != null) {
            customerEmail = order.getUser().getEmail();
            customerName = order.getUser().getFirstName() + " " + order.getUser().getLastName();
        }

        return OrderResponse.builder()
                .orderId(order.getId())
                .status(order.getStatus().name().toLowerCase())
                .customerEmail(customerEmail)
                .customerName(customerName)
                .items(items)
                .amounts(OrderResponse.OrderAmounts.builder()
                        .subtotal(order.getSubtotalAmount())
                        .discount(order.getDiscountAmount())
                        .tax(order.getTaxAmount())
                        .shipping(order.getShippingAmount())
                        .total(order.getTotalAmount())
                        .currency(order.getCurrencyCode())
                        .build())
                .shippingAddress(shippingAddr)
                .paymentMethod(order.getPaymentMethod())
                .installments(order.getInstallments())
                .trackingNumber(order.getTrackingNumber())
                .trackingUrl(order.getTrackingUrl())
                .estimatedDeliveryAt(order.getEstimatedDeliveryAt())
                .adminNotes(order.getAdminNotes())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    @Transactional
    public OrderResponse updateNotes(Long orderId, String notes) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        order.setAdminNotes(notes);
        return mapToResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateTracking(Long orderId, String trackingNumber, String trackingUrl) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        order.setTrackingNumber(trackingNumber);
        order.setTrackingUrl(trackingUrl);
        Order saved = orderRepository.save(order);
        // Optionally notify customer
        User user = saved.getUser();
        if (user != null && trackingNumber != null && !trackingNumber.isBlank()) {
            emailService.sendTrackingUpdate(saved.getId(), trackingNumber, trackingUrl,
                    user.getEmail(), user.getFirstName());
        }
        return mapToResponse(saved);
    }
}
