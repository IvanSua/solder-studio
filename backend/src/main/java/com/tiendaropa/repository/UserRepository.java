package com.tiendaropa.repository;

import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByReferralCode(String referralCode);

    Optional<User> findByEmailVerificationToken(String token);

    long countByRole(UserRole role);

    long countByReferredById(Long referredById);

    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :from")
    long countNewSince(@Param("from") Instant from);
}
