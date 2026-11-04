package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreatePromotionRequest;
import com.tiendaropa.dto.response.CouponValidationResponse;
import com.tiendaropa.dto.response.PromotionResponse;
import com.tiendaropa.entity.Promotion;
import com.tiendaropa.enums.PromotionType;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromotionService {

    private final PromotionRepository promotionRepository;

    @Transactional(readOnly = true)
    public Page<PromotionResponse> listAll(Pageable pageable) {
        return promotionRepository.findAll(pageable).map(this::mapToResponse);
    }

    @Transactional
    public PromotionResponse create(CreatePromotionRequest request) {
        if (request.getEndsAt().isBefore(request.getStartsAt())) {
            throw new BusinessException("endsAt must be after startsAt", HttpStatus.BAD_REQUEST);
        }
        if (request.getCode() != null && !request.getCode().isBlank()) {
            String code = request.getCode().trim().toUpperCase();
            // Check against ALL promotions (active, inactive, expired) to avoid hitting the DB unique constraint.
            promotionRepository.findByCodeIgnoreCase(code)
                    .ifPresent(p -> { throw new BusinessException("El código '" + code + "' ya está en uso", HttpStatus.CONFLICT); });
        }

        Promotion promo = Promotion.builder()
                .name(request.getName())
                .code(request.getCode() != null && !request.getCode().isBlank()
                        ? request.getCode().trim().toUpperCase() : null)
                .description(request.getDescription())
                .scope(request.getScope())
                .type(request.getType())
                .value(request.getValue())
                .priority(request.getPriority())
                .stackable(request.isStackable())
                .targetProductId(request.getTargetProductId())
                .targetCategoryId(request.getTargetCategoryId())
                .minimumPurchaseAmount(request.getMinimumPurchaseAmount())
                .startsAt(request.getStartsAt())
                .endsAt(request.getEndsAt())
                .active(request.isActive())
                .build();

        return mapToResponse(promotionRepository.save(promo));
    }

    @Transactional
    public PromotionResponse update(Long id, CreatePromotionRequest request) {
        Promotion promo = promotionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promotion not found: " + id));

        // If the code is changing, check that the new code isn't already used by another promotion.
        if (request.getCode() != null && !request.getCode().isBlank()) {
            String code = request.getCode().trim().toUpperCase();
            promotionRepository.findByCodeIgnoreCase(code)
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(p -> { throw new BusinessException("El código '" + code + "' ya está en uso", HttpStatus.CONFLICT); });
        }

        promo.setName(request.getName());
        promo.setCode(request.getCode() != null && !request.getCode().isBlank()
                ? request.getCode().trim().toUpperCase() : null);
        promo.setDescription(request.getDescription());
        promo.setScope(request.getScope());
        promo.setType(request.getType());
        promo.setValue(request.getValue());
        promo.setPriority(request.getPriority());
        promo.setStackable(request.isStackable());
        promo.setTargetProductId(request.getTargetProductId());
        promo.setTargetCategoryId(request.getTargetCategoryId());
        promo.setMinimumPurchaseAmount(request.getMinimumPurchaseAmount());
        promo.setStartsAt(request.getStartsAt());
        promo.setEndsAt(request.getEndsAt());
        promo.setActive(request.isActive());

        return mapToResponse(promotionRepository.save(promo));
    }

    @Transactional
    public void delete(Long id) {
        Promotion promo = promotionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promotion not found: " + id));
        promo.setActive(false);
        promotionRepository.save(promo);
    }

    /**
     * Validates a coupon code against a given subtotal and returns the discount amount.
     * Used by both the checkout and the frontend preview endpoint.
     */
    @Transactional(readOnly = true)
    public CouponValidationResponse validateCoupon(String code, long subtotalCentavos) {
        if (code == null || code.isBlank()) {
            return CouponValidationResponse.builder().valid(false).message("Código vacío").discountAmount(0).build();
        }

        Promotion promo = promotionRepository.findValidByCode(code.trim(), Instant.now())
                .orElse(null);

        if (promo == null) {
            return CouponValidationResponse.builder()
                    .valid(false).message("Cupón inválido o expirado").discountAmount(0).build();
        }

        if (promo.getMinimumPurchaseAmount() != null && subtotalCentavos < promo.getMinimumPurchaseAmount()) {
            long minPesos = promo.getMinimumPurchaseAmount() / 100;
            return CouponValidationResponse.builder()
                    .valid(false)
                    .message("Compra mínima de $" + minPesos + " requerida")
                    .discountAmount(0).build();
        }

        long discount = computeDiscount(promo, subtotalCentavos);
        return CouponValidationResponse.builder()
                .valid(true)
                .message("Cupón aplicado: " + promo.getName())
                .discountAmount(discount)
                .promotionName(promo.getName())
                .build();
    }

    /**
     * Computes the discount amount in centavos for the given promotion and subtotal.
     */
    public long computeDiscount(Promotion promo, long subtotalCentavos) {
        if (promo.getType() == PromotionType.PERCENTAGE) {
            // value stored as basis points × 100: e.g. 1500 = 15.00%
            return subtotalCentavos * promo.getValue() / 10000L;
        } else {
            // FIXED_AMOUNT — cap at subtotal
            return Math.min(promo.getValue(), subtotalCentavos);
        }
    }

    private PromotionResponse mapToResponse(Promotion p) {
        return PromotionResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .code(p.getCode())
                .description(p.getDescription())
                .scope(p.getScope())
                .type(p.getType())
                .value(p.getValue())
                .priority(p.getPriority())
                .stackable(p.isStackable())
                .targetProductId(p.getTargetProductId())
                .targetCategoryId(p.getTargetCategoryId())
                .minimumPurchaseAmount(p.getMinimumPurchaseAmount())
                .startsAt(p.getStartsAt())
                .endsAt(p.getEndsAt())
                .active(p.isActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
