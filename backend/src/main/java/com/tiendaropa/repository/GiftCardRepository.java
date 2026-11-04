package com.tiendaropa.repository;

import com.tiendaropa.entity.GiftCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface GiftCardRepository extends JpaRepository<GiftCard, Long> {

    Optional<GiftCard> findByCode(String code);

    List<GiftCard> findByPurchasedById(Long userId);

    /** Used by GiftCardService to detect a retried purchase attempt (idempotency). */
    Optional<GiftCard> findByIdempotencyKeyAndPurchasedById(String idempotencyKey, Long purchasedById);

    List<GiftCard> findByRedeemedById(Long userId);

    @Query("SELECT g FROM GiftCard g WHERE g.active = true AND g.remainingAmount > 0 AND g.expiresAt > :now")
    List<GiftCard> findAllUsableCards(Instant now);

    @Query("SELECT g FROM GiftCard g WHERE g.code = :code AND g.active = true AND g.remainingAmount > 0 AND g.expiresAt > :now")
    Optional<GiftCard> findUsableByCode(String code, Instant now);

    @Query("SELECT SUM(g.remainingAmount) FROM GiftCard g WHERE g.purchasedBy.id = :userId AND g.active = true AND g.remainingAmount > 0")
    BigDecimal sumRemainingByUserId(Long userId);

    @Query("SELECT COALESCE(SUM(g.remainingAmount), 0) FROM GiftCard g WHERE g.active = true AND g.remainingAmount > 0")
    BigDecimal sumAllRemainingAmount();
}
