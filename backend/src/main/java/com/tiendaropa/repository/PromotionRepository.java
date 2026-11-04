package com.tiendaropa.repository;

import com.tiendaropa.entity.Promotion;
import com.tiendaropa.enums.PromotionScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    @Query("SELECT p FROM Promotion p WHERE p.active = true AND p.startsAt <= :now AND p.endsAt > :now " +
           "ORDER BY p.priority DESC")
    List<Promotion> findActivePromotions(@Param("now") Instant now);

    @Query("SELECT p FROM Promotion p WHERE p.active = true AND p.scope = :scope " +
           "AND p.startsAt <= :now AND p.endsAt > :now ORDER BY p.priority DESC")
    List<Promotion> findActiveByScope(@Param("scope") PromotionScope scope, @Param("now") Instant now);

    @Query("SELECT p FROM Promotion p WHERE UPPER(p.code) = UPPER(:code) AND p.active = true " +
           "AND p.startsAt <= :now AND p.endsAt > :now")
    java.util.Optional<Promotion> findValidByCode(@Param("code") String code, @Param("now") Instant now);

    /** Check if ANY promotion (active, inactive, expired) uses this code — used to enforce DB unique constraint. */
    @Query("SELECT p FROM Promotion p WHERE UPPER(p.code) = UPPER(:code)")
    java.util.Optional<Promotion> findByCodeIgnoreCase(@Param("code") String code);
}
