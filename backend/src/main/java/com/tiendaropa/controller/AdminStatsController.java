package com.tiendaropa.controller;

import com.tiendaropa.enums.OrderStatus;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/stats")
@RequiredArgsConstructor
public class AdminStatsController {

    @Value("${app.auth.low-stock-threshold:5}")
    private int lowStockThreshold;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> getStats(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        Instant now = Instant.now();
        ZonedDateTime nowUtc = now.atZone(ZoneOffset.UTC);

        // Parse optional date-range filter (dates arrive as YYYY-MM-DD from Angular)
        ZoneId bsas = ZoneId.of("America/Argentina/Buenos_Aires");
        Instant rangeFrom = (from != null && !from.isBlank())
                ? LocalDate.parse(from).atStartOfDay(bsas).toInstant() : null;
        Instant rangeTo = (to != null && !to.isBlank())
                ? LocalDate.parse(to).plusDays(1).atStartOfDay(bsas).toInstant() : null;
        boolean hasRange = rangeFrom != null && rangeTo != null;

        // Reference instants for month-over-month comparison (always computed)
        Instant startOfMonth   = nowUtc.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS).toInstant();
        Instant startOfLastMonth = nowUtc.withDayOfMonth(1).minusMonths(1).truncatedTo(ChronoUnit.DAYS).toInstant();
        Instant thirtyDaysAgo = now.minus(30, ChronoUnit.DAYS);

        // ── Orders ────────────────────────────────────────────────────────────
        long totalOrders      = hasRange ? orderRepository.countInRange(rangeFrom, rangeTo)
                                         : orderRepository.count();
        long newOrdersLast30  = hasRange ? totalOrders   // repurposed: orders in selected range
                                         : orderRepository.countSince(thirtyDaysAgo);

        // Orders by status
        List<Object[]> rawStatusCounts = hasRange
                ? orderRepository.countByStatusInRange(rangeFrom, rangeTo)
                : orderRepository.countByStatus();
        Map<String, Long> ordersByStatus = new HashMap<>();
        for (Object[] row : rawStatusCounts) {
            ordersByStatus.put(((OrderStatus) row[0]).name(), (Long) row[1]);
        }

        long pendingOrders = ordersByStatus.getOrDefault("PENDING", 0L)
                + ordersByStatus.getOrDefault("AWAITING_PAYMENT", 0L)
                + ordersByStatus.getOrDefault("PAID", 0L)
                + ordersByStatus.getOrDefault("PREPARING", 0L);

        // ── Revenue ───────────────────────────────────────────────────────────
        long totalRevenueCentavos = hasRange
                ? orderRepository.sumDeliveredRevenueInRange(rangeFrom, rangeTo)
                : orderRepository.sumAllDeliveredRevenue();
        long monthRevenueCentavos     = hasRange
                ? totalRevenueCentavos  // same number when filtered
                : orderRepository.sumDeliveredRevenueInRange(startOfMonth, now);
        long lastMonthRevenueCentavos = hasRange
                ? 0L
                : orderRepository.sumDeliveredRevenueInRange(startOfLastMonth, startOfMonth);

        // ── Users ─────────────────────────────────────────────────────────────
        long totalUsers      = userRepository.count();
        long totalCustomers  = userRepository.countByRole(UserRole.CUSTOMER);
        long newUsersLast30  = userRepository.countNewSince(thirtyDaysAgo);

        // ── Products ──────────────────────────────────────────────────────────
        long totalProducts  = productRepository.count();
        long activeProducts = productRepository.findByActiveTrue(PageRequest.of(0, 1)).getTotalElements();
        long lowStockCount  = variantRepository.findLowStock(lowStockThreshold).size();

        // ── Recent orders ─────────────────────────────────────────────────────
        List<com.tiendaropa.entity.Order> rawRecent = hasRange
                ? orderRepository.findTop5InRange(rangeFrom, rangeTo, PageRequest.of(0, 5))
                : orderRepository.findTop5ByOrderByCreatedAtDesc();
        List<Map<String, Object>> recentOrders = rawRecent.stream()
                .map(o -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", o.getId());
                    m.put("status", o.getStatus().name());
                    m.put("total", o.getTotalAmount());
                    m.put("currency", o.getCurrencyCode());
                    m.put("createdAt", o.getCreatedAt().toString());
                    if (o.getUser() != null) {
                        m.put("customerName", o.getUser().getFirstName() + " " + o.getUser().getLastName());
                        m.put("customerEmail", o.getUser().getEmail());
                    }
                    return m;
                })
                .toList();

        // ── Daily revenue sparkline ────────────────────────────────────────────
        Instant sparkFrom = hasRange ? rangeFrom : now.minus(7, ChronoUnit.DAYS);
        List<Object[]> rawDaily = orderRepository.dailyRevenueSince(sparkFrom);
        Map<String, Long> dailyMap = new HashMap<>();
        for (Object[] row : rawDaily) {
            dailyMap.put(row[0].toString(), ((Number) row[1]).longValue());
        }
        // Build 7-day window (or range window up to 7 days) with gap-fill
        LocalDate endDay   = hasRange ? rangeTo.atZone(bsas).toLocalDate().minusDays(1)   : LocalDate.now(bsas);
        LocalDate startDay = hasRange ? rangeFrom.atZone(bsas).toLocalDate() : endDay.minusDays(6);
        // Cap sparkline to 7 points max
        if (java.time.temporal.ChronoUnit.DAYS.between(startDay, endDay) > 6) {
            startDay = endDay.minusDays(6);
        }
        List<Map<String, Object>> dailyRevenue = new ArrayList<>();
        for (LocalDate day = startDay; !day.isAfter(endDay); day = day.plusDays(1)) {
            Map<String, Object> pt = new HashMap<>();
            pt.put("day", day.toString());
            pt.put("total", dailyMap.getOrDefault(day.toString(), 0L));
            dailyRevenue.add(pt);
        }

        // ── Build response ────────────────────────────────────────────────────
        Map<String, Object> response = new HashMap<>();
        response.put("totalOrders", totalOrders);
        response.put("newOrdersLast30Days", newOrdersLast30);
        response.put("pendingOrders", pendingOrders);
        response.put("ordersByStatus", ordersByStatus);
        response.put("totalRevenue", totalRevenueCentavos);
        response.put("monthRevenue", monthRevenueCentavos);
        response.put("lastMonthRevenue", lastMonthRevenueCentavos);
        response.put("totalUsers", totalUsers);
        response.put("totalCustomers", totalCustomers);
        response.put("newUsersLast30Days", newUsersLast30);
        response.put("totalProducts", totalProducts);
        response.put("activeProducts", activeProducts);
        response.put("lowStockCount", lowStockCount);
        response.put("recentOrders", recentOrders);
        response.put("dailyRevenue", dailyRevenue);

        return response;
    }

    /** Low-stock variant alerts — returns variants with stock ≤ threshold (default 5) */
    @GetMapping("/stock-alerts")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> stockAlerts(
            @RequestParam(defaultValue = "5") int threshold) {
        return variantRepository.findLowStock(threshold).stream()
                .map(v -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("variantId", v.getId());
                    m.put("productName", v.getProduct() != null ? v.getProduct().getName() : null);
                    m.put("productId", v.getProduct() != null ? v.getProduct().getId() : null);
                    m.put("color", v.getColor());
                    m.put("size", v.getSize());
                    m.put("stockAvailable", v.getStockAvailable());
                    m.put("active", v.isActive());
                    return m;
                })
                .toList();
    }
}
