package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CreateProductRequest;
import com.tiendaropa.dto.request.CreateVariantRequest;
import com.tiendaropa.dto.request.UpdateProductRequest;
import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.service.ProductService;
import com.tiendaropa.service.RestockNotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/products")
@RequiredArgsConstructor
public class AdminProductController {

    private final ProductService productService;
    private final ProductVariantRepository variantRepository;
    private final RestockNotificationService restockNotificationService;

    /** List ALL products (including inactive) */
    @GetMapping
    public Page<ProductResponse> listAll(Pageable pageable) {
        return productService.listAllProducts(pageable);
    }

    /** Create a new product */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createProduct(@Valid @RequestBody CreateProductRequest request) {
        return productService.createProduct(request);
    }

    /** Update product info (name, description, category, flags) */
    @PutMapping("/{id}")
    public ProductResponse updateProduct(@PathVariable Long id,
                                         @Valid @RequestBody UpdateProductRequest request) {
        return productService.updateProduct(id, request);
    }

    /** Add a new variant to an existing product */
    @PostMapping("/{id}/variants")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse.VariantResponse addVariant(@PathVariable Long id,
                                                       @Valid @RequestBody CreateVariantRequest request) {
        return productService.addVariant(id, request);
    }

    /** Soft-delete (deactivate) a variant */
    @DeleteMapping("/{productId}/variants/{variantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVariant(@PathVariable Long productId, @PathVariable Long variantId) {
        productService.deleteVariant(productId, variantId);
    }

    /** Toggle product active/inactive */
    @PatchMapping("/{id}/active")
    public ProductResponse toggleActive(@PathVariable Long id,
                                        @RequestBody Map<String, Boolean> body) {
        Boolean active = body.get("active");
        if (active == null) {
            throw new BusinessException("'active' field is required", HttpStatus.BAD_REQUEST);
        }
        return productService.setProductActive(id, active);
    }

    /** Update a variant's stock total (set absolute value) */
    @PatchMapping("/{productId}/variants/{variantId}/stock")
    public ProductResponse.VariantResponse updateVariantStock(
            @PathVariable Long productId,
            @PathVariable Long variantId,
            @RequestBody Map<String, Integer> body) {
        Integer stock = body.get("stock");
        if (stock == null || stock < 0) {
            throw new BusinessException("'stock' must be a non-negative integer", HttpStatus.BAD_REQUEST);
        }
        ProductVariant variant = variantRepository.findByIdWithProductDetails(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variant not found: " + variantId));

        boolean wasOutOfStock = variant.getStockAvailable() <= 0;
        variant.setStockTotal(stock);
        variantRepository.save(variant);
        productService.evictProductCaches();

        if (wasOutOfStock && stock > 0 && variant.getProduct() != null) {
            restockNotificationService.notifyWishlistUsers(variant.getProduct());
        }

        return toVariantResponse(variant);
    }

    /**
     * Adjust stock by a signed delta.
     * Positive delta = replenish (e.g. +10 units received).
     * Negative delta = deduct    (e.g. -3 units damaged).
     * Result is clamped at stockReserved (can't go below 0 available).
     */
    @PatchMapping("/{productId}/variants/{variantId}/stock/adjust")
    public ProductResponse.VariantResponse adjustVariantStock(
            @PathVariable Long productId,
            @PathVariable Long variantId,
            @RequestBody Map<String, Integer> body) {
        Integer delta = body.get("delta");
        if (delta == null || delta == 0) {
            throw new BusinessException("'delta' must be a non-zero integer", HttpStatus.BAD_REQUEST);
        }
        ProductVariant variant = variantRepository.findByIdWithProductDetails(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variant not found: " + variantId));

        boolean wasOutOfStock = variant.getStockAvailable() <= 0;
        int newTotal = Math.max(variant.getStockReserved(), variant.getStockTotal() + delta);
        variant.setStockTotal(newTotal);
        variantRepository.save(variant);
        productService.evictProductCaches();

        if (wasOutOfStock && newTotal > variant.getStockReserved() && variant.getProduct() != null) {
            restockNotificationService.notifyWishlistUsers(variant.getProduct());
        }

        return toVariantResponse(variant);
    }

    /** Update a variant's price (in centavos) */
    @PatchMapping("/{productId}/variants/{variantId}/price")
    public ProductResponse.VariantResponse updateVariantPrice(
            @PathVariable Long productId,
            @PathVariable Long variantId,
            @RequestBody Map<String, Long> body) {
        Long price = body.get("price");
        if (price == null || price <= 0) {
            throw new BusinessException("'price' must be a positive integer (centavos)", HttpStatus.BAD_REQUEST);
        }
        ProductVariant variant = variantRepository.findById(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variant not found: " + variantId));
        variant.setPriceAmount(price);
        variantRepository.save(variant);
        productService.evictProductCaches();
        return toVariantResponse(variant);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ProductResponse.VariantResponse toVariantResponse(ProductVariant v) {
        return ProductResponse.VariantResponse.builder()
                .id(v.getId())
                .color(v.getColor())
                .size(v.getSize())
                .priceAmount(v.getPriceAmount())
                .currencyCode(v.getCurrencyCode())
                .stockTotal(v.getStockTotal())
                .stockReserved(v.getStockReserved())
                .stockAvailable(v.getStockTotal() - v.getStockReserved())
                .sku(v.getSku())
                .build();
    }

    // ── Image management endpoints ────────────────────────────────────────────

    /** List all images for a product */
    @GetMapping("/{id}/images")
    public List<ProductResponse.ImageResponse> listImages(@PathVariable Long id) {
        return productService.getProductImages(id);
    }

    /**
     * Upload a new image for a product.
     * Send as multipart/form-data:
     *   - file: the image file
     *   - altText: optional alt text
     *   - primary: optional boolean (true to set as primary)
     */
    @PostMapping("/{id}/images")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse.ImageResponse uploadImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "altText", required = false, defaultValue = "") String altText,
            @RequestParam(value = "primary", required = false, defaultValue = "false") boolean primary)
            throws IOException {
        return productService.uploadProductImage(id, file, altText, primary);
    }

    /** Delete an image */
    @DeleteMapping("/{id}/images/{imageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@PathVariable Long id, @PathVariable Long imageId) {
        productService.deleteProductImage(id, imageId);
    }

    /** Set an image as the primary (main) image */
    @PatchMapping("/{id}/images/{imageId}/primary")
    public ProductResponse.ImageResponse setImagePrimary(
            @PathVariable Long id,
            @PathVariable Long imageId) {
        return productService.setImageAsPrimary(id, imageId);
    }
}
