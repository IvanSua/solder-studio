package com.tiendaropa.entity;

import com.tiendaropa.enums.ReturnStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "return_requests",
    indexes = {
        @Index(name = "idx_returns_order",  columnList = "order_id"),
        @Index(name = "idx_returns_user",   columnList = "user_id"),
        @Index(name = "idx_returns_status", columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReturnRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The order being returned */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** The customer who submitted the request */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Why the customer wants to return: DEFECTIVE, WRONG_SIZE, CHANGED_MIND, OTHER */
    @Column(nullable = false, length = 30)
    private String reason;

    /** Free-text details provided by the customer */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** What the customer wants: REFUND or EXCHANGE */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String resolution = "REFUND";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReturnStatus status = ReturnStatus.PENDING;

    /** Admin notes (internal, not shown to customer) */
    @Column(columnDefinition = "TEXT")
    private String adminNotes;

    /** Amount to refund in centavos (set by admin when approving a monetary refund) */
    private Long refundAmount;

    /** True once the refund has been successfully submitted to the payment provider */
    @Builder.Default
    private Boolean refundProcessed = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
