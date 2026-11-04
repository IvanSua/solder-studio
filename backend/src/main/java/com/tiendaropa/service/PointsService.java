package com.tiendaropa.service;

import com.tiendaropa.dto.response.LoyaltyProfileResponse;
import com.tiendaropa.dto.response.PointTransactionResponse;
import com.tiendaropa.dto.response.SavedSizeResponse;
import com.tiendaropa.entity.PointTransaction;
import com.tiendaropa.entity.SavedSize;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserLevel;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.PointTransactionRepository;
import com.tiendaropa.repository.SavedSizeRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PointsService {

    private final UserRepository userRepository;
    private final PointTransactionRepository txRepository;
    private final SavedSizeRepository savedSizeRepository;
    private final EmailService emailService;
    private final BusinessMetricsService metrics;

    // ── Level thresholds ─────────────────────────────────────────────────────

    public UserLevel calculateLevel(int points) {
        if (points >= UserLevel.PLATINUM.getMinPoints()) return UserLevel.PLATINUM;
        if (points >= UserLevel.GOLD.getMinPoints())     return UserLevel.GOLD;
        if (points >= UserLevel.SILVER.getMinPoints())   return UserLevel.SILVER;
        return UserLevel.BRONZE;
    }

    // ── Award/Deduct points ───────────────────────────────────────────────────

    @Transactional
    public void awardPoints(Long userId, int amount, String reason, Long referenceId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        user.setPoints(user.getPoints() + amount);
        user.setLevel(calculateLevel(user.getPoints()));
        userRepository.save(user);

        // Track positive awards (not redemptions, those are tracked separately)
        if (amount > 0) {
            metrics.pointsAwarded(reason, amount);
        }

        txRepository.save(PointTransaction.builder()
                .user(user)
                .amount(amount)
                .reason(reason)
                .referenceId(referenceId)
                .build());

        // Email notification (async via EmailService)
        emailService.sendPointsAwarded(
                amount,
                user.getPoints(),
                reason,
                user.getEmail(),
                user.getFirstName()
        );
    }

    // ── Redeem points ─────────────────────────────────────────────────────────

    /**
     * Deducts {@code pointsToRedeem} from the user's balance as a checkout discount.
     * Caller must have already validated that the user has enough points.
     *
     * @param userId         the user spending points
     * @param pointsToRedeem number of points to spend (must be &gt; 0)
     * @param orderId        the order being paid
     */
    @Transactional
    public void redeemPoints(Long userId, int pointsToRedeem, Long orderId) {
        if (pointsToRedeem <= 0) return;
        awardPoints(userId, -pointsToRedeem, "ORDER_REDEMPTION", orderId);
    }

    // ── Points from order (1 pt per $100 ARS) ────────────────────────────────

    /**
     * Call when an order reaches DELIVERED status.
     * totalAmount is stored as Long cents. 1 point per $100 ARS = per 10_000 cents.
     */
    @Transactional
    public void awardOrderPoints(Long userId, Long orderId, Long totalAmountCents) {
        if (totalAmountCents == null || totalAmountCents <= 0) return;
        int pts = (int)(totalAmountCents / 10_000L);
        if (pts > 0) {
            awardPoints(userId, pts, "ORDER_DELIVERED", orderId);
        }
    }

    // ── Loyalty profile ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public LoyaltyProfileResponse getLoyalty(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        UserLevel level = calculateLevel(user.getPoints());
        int pts = user.getPoints();

        int nextLevelPts;
        double progress;
        int toNext;

        if (level == UserLevel.PLATINUM) {
            nextLevelPts = 0;
            toNext = 0;
            progress = 1.0;
        } else {
            UserLevel next = nextLevel(level);
            nextLevelPts = next.getMinPoints();
            toNext = nextLevelPts - pts;
            int range = nextLevelPts - level.getMinPoints();
            progress = range > 0 ? (double)(pts - level.getMinPoints()) / range : 1.0;
        }

        // Count referrals
        long referralCount = userRepository.countByReferredById(userId);

        // Saved sizes
        List<SavedSizeResponse> sizes = savedSizeRepository
                .findByUserIdOrderByCategoryName(userId)
                .stream()
                .map(s -> SavedSizeResponse.builder()
                        .categoryName(s.getCategoryName())
                        .size(s.getSize())
                        .build())
                .toList();

        return LoyaltyProfileResponse.builder()
                .points(pts)
                .level(level.name())
                .levelLabel(level.getLabel())
                .nextLevelPoints(nextLevelPts)
                .pointsToNextLevel(toNext)
                .levelProgress(Math.min(1.0, progress))
                .referralCode(user.getReferralCode())
                .referralCount((int) referralCount)
                .savedSizes(sizes)
                .build();
    }

    // ── Points history ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<PointTransactionResponse> getHistory(Long userId, Pageable pageable) {
        return txRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(tx -> PointTransactionResponse.builder()
                        .id(tx.getId())
                        .amount(tx.getAmount())
                        .reason(tx.getReason())
                        .referenceId(tx.getReferenceId())
                        .createdAt(tx.getCreatedAt())
                        .build());
    }

    // ── Saved sizes ────────────────────────────────────────────────────────────

    @Transactional
    public List<SavedSizeResponse> saveSizes(Long userId,
            List<com.tiendaropa.dto.request.SavedSizesRequest.SizeEntry> entries) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        for (var entry : entries) {
            SavedSize ss = savedSizeRepository
                    .findByUserIdAndCategoryName(userId, entry.getCategoryName())
                    .orElse(SavedSize.builder().user(user).categoryName(entry.getCategoryName()).build());
            ss.setSize(entry.getSize());
            savedSizeRepository.save(ss);
        }

        return savedSizeRepository.findByUserIdOrderByCategoryName(userId)
                .stream()
                .map(s -> SavedSizeResponse.builder()
                        .categoryName(s.getCategoryName())
                        .size(s.getSize())
                        .build())
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserLevel nextLevel(UserLevel current) {
        return switch (current) {
            case BRONZE -> UserLevel.SILVER;
            case SILVER -> UserLevel.GOLD;
            case GOLD   -> UserLevel.PLATINUM;
            default     -> UserLevel.PLATINUM;
        };
    }
}
