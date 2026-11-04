package com.tiendaropa.controller;

import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.OrderItem;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.repository.OrderRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Admin endpoints for exporting data as CSV files.
 * All endpoints are protected by the ADMIN/WORKER role via Spring Security.
 */
@RestController
@RequestMapping("/api/v1/admin/export")
@RequiredArgsConstructor
public class AdminExportController {

    private static final ZoneId BSAS = ZoneId.of("America/Argentina/Buenos_Aires");
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(BSAS);

    private final OrderRepository orderRepository;
    private final ProductVariantRepository variantRepository;

    /**
     * Export all orders as CSV.
     * Each row = one order item line (one order may produce multiple rows).
     */
    @GetMapping(value = "/orders.csv", produces = "text/csv")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportOrders() {
        List<Order> orders = orderRepository.findAll(Pageable.unpaged()).getContent();

        StringBuilder sb = new StringBuilder();
        sb.append("order_id,created_at,status,customer_name,customer_email," +
                  "product_name,color,size,quantity,unit_price_ars," +
                  "subtotal,discount,tax,shipping,total,currency\n");

        for (Order o : orders) {
            String createdAt  = DATE_FMT.format(o.getCreatedAt());
            String status     = o.getStatus().name();
            String custName   = o.getUser() != null
                    ? escapeCsv(o.getUser().getFirstName() + " " + o.getUser().getLastName()) : "";
            String custEmail  = o.getUser() != null ? o.getUser().getEmail() : "";
            long subtotal     = o.getSubtotalAmount();
            long discount     = o.getDiscountAmount();
            long tax          = o.getTaxAmount();
            long shipping     = o.getShippingAmount();
            long total        = o.getTotalAmount();
            String currency   = o.getCurrencyCode();

            if (o.getItems().isEmpty()) {
                sb.append(String.join(",",
                        o.getId().toString(), createdAt, status, custName, custEmail,
                        "", "", "", "0", "0",
                        centsToPesos(subtotal), centsToPesos(discount), centsToPesos(tax),
                        centsToPesos(shipping), centsToPesos(total), currency
                )).append("\n");
            } else {
                for (OrderItem item : o.getItems()) {
                    sb.append(String.join(",",
                            o.getId().toString(), createdAt, status, custName, custEmail,
                            escapeCsv(item.getProductName()),
                            escapeCsv(item.getVariantColor() != null ? item.getVariantColor() : ""),
                            escapeCsv(item.getVariantSize() != null ? item.getVariantSize() : ""),
                            String.valueOf(item.getQuantity()),
                            centsToPesos(item.getUnitPriceAmount()),
                            centsToPesos(subtotal), centsToPesos(discount), centsToPesos(tax),
                            centsToPesos(shipping), centsToPesos(total), currency
                    )).append("\n");
                }
            }
        }

        byte[] bytes = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"orders.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    /**
     * Export all product variants (stock sheet) as CSV.
     */
    @GetMapping(value = "/products.csv", produces = "text/csv")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportProducts(
            @RequestParam(defaultValue = "false") boolean lowStockOnly,
            @RequestParam(defaultValue = "5") int threshold) {

        List<ProductVariant> variants = lowStockOnly
                ? variantRepository.findLowStock(threshold)
                : variantRepository.findAll();

        StringBuilder sb = new StringBuilder();
        sb.append("variant_id,product_id,product_name,category,color,size," +
                  "stock_available,stock_reserved,active\n");

        for (ProductVariant v : variants) {
            String productName = v.getProduct() != null ? escapeCsv(v.getProduct().getName()) : "";
            String productId   = v.getProduct() != null ? v.getProduct().getId().toString() : "";
            String category    = (v.getProduct() != null && v.getProduct().getCategory() != null)
                    ? escapeCsv(v.getProduct().getCategory().getName()) : "";

            sb.append(String.join(",",
                    v.getId().toString(), productId, productName, category,
                    escapeCsv(v.getColor() != null ? v.getColor() : ""),
                    escapeCsv(v.getSize() != null ? v.getSize() : ""),
                    String.valueOf(v.getStockAvailable()),
                    String.valueOf(v.getStockReserved()),
                    String.valueOf(v.isActive())
            )).append("\n");
        }

        byte[] bytes = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String filename = lowStockOnly ? "low-stock.csv" : "products.csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Convert centavos (Long) to ARS pesos string with 2 decimal places. */
    private String centsToPesos(long centavos) {
        return String.format("%.2f", centavos / 100.0);
    }

    /** Wrap field in double-quotes and escape internal quotes (RFC 4180). */
    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
