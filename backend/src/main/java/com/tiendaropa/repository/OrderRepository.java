package com.tiendaropa.repository;

import com.tiendaropa.entity.Order;
import com.tiendaropa.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    /**
     * Fully loads order + all associations (items → variant → product → images).
     * Used by single-order endpoints where every field is needed.
     */
    @Override
    @EntityGraph("Order.withDetails")
    Optional<Order> findById(Long id);

    /**
     * Admin paginated list — loads user and shippingAddress eagerly.
     * Items are batched via @BatchSize(30) on Order.items.
     */
    @Override
    @EntityGraph(attributePaths = {"user", "shippingAddress"})
    Page<Order> findAll(Pageable pageable);

    /**
     * Fully loads the order for the authenticated user.
     * Used by customer order-detail and cancel endpoints.
     */
    @EntityGraph("Order.withDetails")
    Optional<Order> findByIdAndUserId(Long id, Long userId);

    /**
     * Paginated order list for a customer.
     * Only @ManyToOne associations are included in the graph to avoid in-memory pagination.
     * The items collection is batched via @BatchSize(30) on Order.items.
     */
    @EntityGraph(attributePaths = {"user", "shippingAddress"})
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Optional<Order> findByPaymentExternalId(String paymentExternalId);

    /** Used by CheckoutService to detect a retried checkout attempt (idempotency). */
    Optional<Order> findByIdempotencyKeyAndUserId(String idempotencyKey, Long userId);

    @EntityGraph(attributePaths = {"user", "shippingAddress"})
    Page<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "shippingAddress"})
    Page<Order> findByStatusInOrderByCreatedAtDesc(Collection<OrderStatus> statuses, Pageable pageable);

    /**
     * Admin filtered query: optional status + optional search by order ID, customer email or name.
     * Pass null to skip a filter.
     */
    @EntityGraph(attributePaths = {"user", "shippingAddress"})
    @Query("""
            SELECT o FROM Order o LEFT JOIN o.user u
            WHERE (:status IS NULL OR o.status = :status)
            AND (:q IS NULL OR :q = ''
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :q, '%'))
                OR CAST(o.id AS string) LIKE CONCAT('%', :q, '%'))
            ORDER BY o.createdAt DESC
            """)
    Page<Order> findFiltered(@Param("status") OrderStatus status,
                             @Param("q") String q,
                             Pageable pageable);

    @Query("SELECT SUM(o.totalAmount) FROM Order o WHERE o.status = :status AND o.createdAt BETWEEN :from AND :to")
    Long sumTotalByStatusAndDateRange(@Param("status") OrderStatus status,
                                     @Param("from") Instant from,
                                     @Param("to") Instant to);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status AND o.createdAt BETWEEN :from AND :to")
    Long countByStatusAndDateRange(@Param("status") OrderStatus status,
                                  @Param("from") Instant from,
                                  @Param("to") Instant to);

    /** Total revenue (sum of totalAmount) for orders that are DELIVERED */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.status = 'DELIVERED'")
    Long sumAllDeliveredRevenue();

    /** Revenue for DELIVERED orders in a date range */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.status = 'DELIVERED' AND o.createdAt BETWEEN :from AND :to")
    Long sumDeliveredRevenueInRange(@Param("from") Instant from, @Param("to") Instant to);

    /** Count orders per status */
    @Query("SELECT o.status, COUNT(o) FROM Order o GROUP BY o.status")
    List<Object[]> countByStatus();

    /** Count orders created after a timestamp (for period comparison) */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.createdAt >= :from")
    Long countSince(@Param("from") Instant from);

    /** 5 most recent orders for the dashboard */
    @EntityGraph(attributePaths = {"user"})
    List<Order> findTop5ByOrderByCreatedAtDesc();

    /** Count delivered orders for a user — used to detect the first purchase for referral bonus */
    long countByUserIdAndStatus(Long userId, OrderStatus status);

    /** Returns true if the user has at least one DELIVERED order containing the given product */
    @Query("""
            SELECT COUNT(o) > 0 FROM Order o
            JOIN o.items i
            JOIN i.productVariant pv
            WHERE o.user.id = :userId
              AND pv.product.id = :productId
              AND o.status = com.tiendaropa.enums.OrderStatus.DELIVERED
            """)
    boolean existsDeliveredOrderForUserAndProduct(@Param("userId") Long userId,
                                                   @Param("productId") Long productId);

    /** Daily revenue for DELIVERED orders in a date range — for sparkline charts */
    @Query(value = """
            SELECT DATE(o.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
                   COALESCE(SUM(o.total_amount), 0) AS total
            FROM orders o
            WHERE o.status = 'DELIVERED'
              AND o.created_at >= :from
            GROUP BY day
            ORDER BY day
            """, nativeQuery = true)
    List<Object[]> dailyRevenueSince(@Param("from") Instant from);

    /** Count all orders in a range regardless of status */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.createdAt >= :from AND o.createdAt < :to")
    Long countInRange(@Param("from") Instant from, @Param("to") Instant to);

    /** Count orders per status in a date range */
    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.createdAt >= :from AND o.createdAt < :to GROUP BY o.status")
    List<Object[]> countByStatusInRange(@Param("from") Instant from, @Param("to") Instant to);

    /** 5 most recent orders in a date range */
    @EntityGraph(attributePaths = {"user"})
    @Query("SELECT o FROM Order o WHERE o.createdAt >= :from AND o.createdAt < :to ORDER BY o.createdAt DESC")
    List<Order> findTop5InRange(@Param("from") Instant from, @Param("to") Instant to, Pageable pageable);
}
