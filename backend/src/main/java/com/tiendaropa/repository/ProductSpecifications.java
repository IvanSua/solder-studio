package com.tiendaropa.repository;

import com.tiendaropa.dto.request.ProductFilterRequest;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductVariant;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * JPA Specifications for Product filtering.
 * Replaces the SpEL-based JPQL query which is incompatible with Hibernate 6.
 */
public class ProductSpecifications {

    private ProductSpecifications() {}

    public static Specification<Product> withFilter(ProductFilterRequest filter) {
        return (root, query, cb) -> {

            List<Predicate> predicates = new ArrayList<>();

            // ── Join variants (needed for price / size / color / stock filters) ──
            Join<Product, ProductVariant> variant = root.join("variants", JoinType.INNER);
            predicates.add(cb.isTrue(variant.get("active")));

            // ── Product must be active ────────────────────────────────────────
            predicates.add(cb.isTrue(root.get("active")));

            // ── Text search ───────────────────────────────────────────────────
            if (filter.getQuery() != null && !filter.getQuery().isBlank()) {
                String pattern = "%" + filter.getQuery().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern)
                ));
            }

            // ── Category ──────────────────────────────────────────────────────
            if (filter.getCategoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("id"), filter.getCategoryId()));
            }

            // ── Price range ───────────────────────────────────────────────────
            if (filter.getPriceMin() != null) {
                predicates.add(cb.greaterThanOrEqualTo(variant.get("priceAmount"), filter.getPriceMin()));
            }
            if (filter.getPriceMax() != null) {
                predicates.add(cb.lessThanOrEqualTo(variant.get("priceAmount"), filter.getPriceMax()));
            }

            // ── Sizes ─────────────────────────────────────────────────────────
            if (filter.getSizes() != null && !filter.getSizes().isEmpty()) {
                predicates.add(variant.get("size").in(filter.getSizes()));
            }

            // ── Colors ────────────────────────────────────────────────────────
            if (filter.getColors() != null && !filter.getColors().isEmpty()) {
                predicates.add(variant.get("color").in(filter.getColors()));
            }

            // ── In stock only ─────────────────────────────────────────────────
            if (filter.isInStockOnly()) {
                Expression<Integer> available = cb.diff(
                    variant.<Integer>get("stockTotal"),
                    variant.<Integer>get("stockReserved")
                );
                predicates.add(cb.greaterThan(available, 0));
            }

            // ── Avoid duplicate products from multi-variant join ──────────────
            if (query != null && query.getResultType() != Long.class) {
                query.distinct(true);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
