package com.tiendaropa.service;

import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.entity.StockReservation;
import com.tiendaropa.entity.User;
import com.tiendaropa.config.properties.CheckoutProperties;
import com.tiendaropa.enums.ReservationStatus;
import com.tiendaropa.exception.InsufficientStockException;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.StockReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StockService {

    private final ProductVariantRepository variantRepository;
    private final StockReservationRepository reservationRepository;
    private final CheckoutProperties checkoutProperties;

    @Transactional
    public StockReservation reserveStock(Long variantId, int quantity, User user, Order order) {
        ProductVariant variant = variantRepository.findByIdForUpdate(variantId)
                .orElseThrow(() -> new InsufficientStockException("Variant not found: " + variantId));

        if (variant.getStockAvailable() < quantity) {
            throw new InsufficientStockException(
                    "Insufficient stock for variant " + variantId +
                    ": requested " + quantity + ", available " + variant.getStockAvailable());
        }

        variant.setStockReserved(variant.getStockReserved() + quantity);
        variantRepository.save(variant);

        StockReservation reservation = StockReservation.builder()
                .variant(variant)
                .user(user)
                .order(order)
                .quantity(quantity)
                .status(ReservationStatus.ACTIVE)
                .expiresAt(Instant.now().plus(checkoutProperties.reservationExpiryMinutes(), ChronoUnit.MINUTES))
                .build();

        return reservationRepository.save(reservation);
    }

    @Transactional
    public void consumeReservation(StockReservation reservation) {
        reservation.setStatus(ReservationStatus.CONSUMED);
        reservationRepository.save(reservation);
    }

    @Transactional
    public void releaseReservation(StockReservation reservation) {
        if (reservation.getStatus() != ReservationStatus.ACTIVE) {
            return;
        }

        ProductVariant variant = variantRepository.findByIdForUpdate(reservation.getVariant().getId())
                .orElse(null);
        if (variant != null) {
            variant.setStockReserved(Math.max(0, variant.getStockReserved() - reservation.getQuantity()));
            variantRepository.save(variant);
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);
    }

    @Scheduled(fixedRate = 60000) // every minute
    @Transactional
    public void expireReservations() {
        List<StockReservation> expired = reservationRepository.findExpiredReservations(
                ReservationStatus.ACTIVE, Instant.now());

        for (StockReservation reservation : expired) {
            log.info("Expiring reservation {} for variant {}", reservation.getId(), reservation.getVariant().getId());

            ProductVariant variant = variantRepository.findByIdForUpdate(reservation.getVariant().getId())
                    .orElse(null);
            if (variant != null) {
                variant.setStockReserved(Math.max(0, variant.getStockReserved() - reservation.getQuantity()));
                variantRepository.save(variant);
            }

            reservation.setStatus(ReservationStatus.EXPIRED);
            reservationRepository.save(reservation);
        }

        if (!expired.isEmpty()) {
            log.info("Expired {} stock reservations", expired.size());
        }
    }
}
