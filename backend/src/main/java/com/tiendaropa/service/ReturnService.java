package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreateReturnRequest;
import com.tiendaropa.dto.response.ReturnRequestResponse;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.ReturnRequest;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.NotificationType;
import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.ReturnStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ReturnRequestRepository;
import com.tiendaropa.repository.UserRepository;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReturnService {

    private final ReturnRequestRepository returnRepo;
    private final OrderRepository         orderRepo;
    private final UserRepository          userRepo;
    private final NotificationService     notificationService;
    private final EmailService            emailService;
    private final MercadoPagoService      mercadoPagoService;

    /** Orders must be in one of these statuses to be eligible for a return */
    private static final EnumSet<OrderStatus> ELIGIBLE_STATUSES =
            EnumSet.of(OrderStatus.DELIVERED);

    /** Terminal statuses — an order with one of these cannot get a new return request */
    private static final List<ReturnStatus> TERMINAL_STATUSES =
            List.of(ReturnStatus.COMPLETED, ReturnStatus.REJECTED);

    // ── Customer endpoints ────────────────────────────────────────────────────

    @Transactional
    public ReturnRequestResponse create(Long userId, CreateReturnRequest req) {
        User  user  = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Order order = orderRepo.findByIdAndUserId(req.getOrderId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        // Only delivered orders can be returned
        if (!ELIGIBLE_STATUSES.contains(order.getStatus())) {
            throw new IllegalStateException(
                    "Order #" + order.getId() + " is not eligible for a return (status: " + order.getStatus() + ")");
        }

        // Prevent duplicate open requests for the same order
        if (returnRepo.existsByOrderIdAndStatusNotIn(order.getId(), TERMINAL_STATUSES)) {
            throw new IllegalStateException("A return request already exists for order #" + order.getId());
        }

        ReturnRequest entity = ReturnRequest.builder()
                .order(order)
                .user(user)
                .reason(req.getReason())
                .description(req.getDescription())
                .resolution(req.getResolution())
                .build();

        entity = returnRepo.save(entity);

        // Notify customer
        notificationService.createAsync(userId, NotificationType.ORDER_STATUS_CHANGE,
                "Solicitud de devolución recibida",
                "Recibimos tu solicitud de devolución para el pedido #" + order.getId() + ". Te notificaremos cuando sea revisada.",
                "/orders");

        // Email confirmation (async via EmailService)
        emailService.sendReturnStatusUpdate(
                entity.getId(),
                order.getId(),
                "PENDING",
                "Recibimos tu solicitud de devolución para el pedido #" + order.getId() + ". Te notificaremos cuando sea revisada.",
                entity.getResolution(),
                user.getEmail(),
                user.getFirstName()
        );

        return ReturnRequestResponse.from(entity);
    }

    @Transactional(readOnly = true)
    public List<ReturnRequestResponse> getMyReturns(Long userId) {
        return returnRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(ReturnRequestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReturnRequestResponse getMyReturn(Long userId, Long returnId) {
        ReturnRequest r = returnRepo.findByIdAndUserId(returnId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Return request not found"));
        return ReturnRequestResponse.from(r);
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ReturnRequestResponse> adminList(ReturnStatus status, Pageable pageable) {
        Page<ReturnRequest> page = (status != null)
                ? returnRepo.findByStatusOrderByCreatedAtDesc(status, pageable)
                : returnRepo.findAllByOrderByCreatedAtDesc(pageable);
        return page.map(ReturnRequestResponse::fromAdmin);
    }

    @Transactional(readOnly = true)
    public ReturnRequestResponse adminGet(Long returnId) {
        ReturnRequest r = returnRepo.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("Return request not found"));
        return ReturnRequestResponse.fromAdmin(r);
    }

    /**
     * Admin updates the status and optionally adds internal notes.
     *
     * @param patch map with optional keys: status, adminNotes
     */
    @Transactional
    public ReturnRequestResponse adminUpdate(Long returnId, Map<String, String> patch) {
        ReturnRequest r = returnRepo.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("Return request not found"));

        ReturnStatus prevStatus = r.getStatus();

        if (patch.containsKey("status")) {
            r.setStatus(ReturnStatus.valueOf(patch.get("status").toUpperCase()));
        }
        if (patch.containsKey("adminNotes")) {
            r.setAdminNotes(patch.get("adminNotes"));
        }
        if (patch.containsKey("refundAmount")) {
            r.setRefundAmount(Long.parseLong(patch.get("refundAmount")));
        }

        r = returnRepo.save(r);

        // Notify customer if status changed
        if (r.getStatus() != prevStatus) {
            String title   = "Actualización de devolución #" + r.getId();
            String message = buildCustomerMessage(r);
            notificationService.createAsync(r.getUser().getId(), NotificationType.ORDER_STATUS_CHANGE,
                    title, message, "/orders");

            // Email notification (async via EmailService)
            User user = r.getUser();
            emailService.sendReturnStatusUpdate(
                    r.getId(),
                    r.getOrder().getId(),
                    r.getStatus().name(),
                    message,
                    r.getResolution(),
                    user.getEmail(),
                    user.getFirstName()
            );
        }

        return ReturnRequestResponse.fromAdmin(r);
    }

    /**
     * Processes a monetary refund via the payment provider (MercadoPago).
     *
     * Rules:
     * - Only works when Order.paymentExternalId is set (MP payment received)
     * - Idempotent: second call throws if already processed
     * - amount must be ≤ order.totalAmount
     *
     * @param returnId       the return request ID
     * @param amountCentavos refund amount in centavos (ARS minimum unit)
     */
    @Transactional
    public ReturnRequestResponse processRefund(Long returnId, Long amountCentavos) {
        ReturnRequest r = returnRepo.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("Return request not found"));

        if (Boolean.TRUE.equals(r.getRefundProcessed())) {
            throw new BusinessException("Refund already processed for this return request", HttpStatus.CONFLICT);
        }

        Order order = r.getOrder();
        String paymentExternalId = order.getPaymentExternalId();
        if (paymentExternalId == null || paymentExternalId.isBlank()) {
            throw new BusinessException(
                    "No payment ID on file for order #" + order.getId() + " — cannot issue MP refund",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        if (amountCentavos <= 0 || amountCentavos > order.getTotalAmount()) {
            throw new BusinessException(
                    "Refund amount must be between 1 and " + order.getTotalAmount() + " centavos",
                    HttpStatus.BAD_REQUEST);
        }

        // Call MP — throws BusinessException on failure
        mercadoPagoService.createPartialRefund(paymentExternalId, amountCentavos);

        r.setRefundAmount(amountCentavos);
        r.setRefundProcessed(true);
        r = returnRepo.save(r);

        // Notify customer
        User user = r.getUser();
        notificationService.createAsync(user.getId(), NotificationType.ORDER_REFUNDED,
                "Reembolso procesado",
                "Se procesó un reembolso de $" + (amountCentavos / 100.0) + " ARS para tu pedido #" + order.getId() + ".",
                "/orders/" + order.getId());

        return ReturnRequestResponse.fromAdmin(r);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildCustomerMessage(ReturnRequest r) {
        return switch (r.getStatus()) {
            case APPROVED     -> "Tu solicitud de devolución para el pedido #" + r.getOrder().getId()
                                 + " fue aprobada. Por favor enviá el producto de vuelta.";
            case IN_PROGRESS  -> "Recibimos el producto de tu devolución. Estamos procesando tu "
                                 + (r.getResolution().equalsIgnoreCase("EXCHANGE") ? "cambio." : "reembolso.");
            case COMPLETED    -> "Tu devolución del pedido #" + r.getOrder().getId()
                                 + " fue completada. "
                                 + (r.getResolution().equalsIgnoreCase("EXCHANGE") ? "¡Tu nuevo producto está en camino!" : "El reembolso fue acreditado.");
            case REJECTED     -> "Tu solicitud de devolución para el pedido #" + r.getOrder().getId()
                                 + " fue rechazada. Contactanos para más información.";
            default           -> "El estado de tu devolución fue actualizado a " + r.getStatus().name().toLowerCase() + ".";
        };
    }
}
