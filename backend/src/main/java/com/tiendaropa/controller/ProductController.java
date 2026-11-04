package com.tiendaropa.controller;

import com.tiendaropa.dto.request.ProductFilterRequest;
import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.dto.response.VariantDetailResponse;
import com.tiendaropa.dto.response.AutocompleteItem;
import com.tiendaropa.dto.response.FilterOptionsResponse;
import com.tiendaropa.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    /**
     * List active products with optional filters.
     * All query params are optional — omitting them returns all active products.
     *
     * @param q          text search (name / description), ignored if blank
     * @param categoryId filter by category ID, ignored if null
     * @param priceMin   minimum price in centavos, ignored if null
     * @param priceMax   maximum price in centavos, ignored if null
     * @param sizes      list of sizes to filter by, ignored if null or empty
     * @param colors     list of colors to filter by, ignored if null or empty
     * @param inStockOnly if true, only return products with available stock
     */
    @GetMapping
    public Page<ProductResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long priceMin,
            @RequestParam(required = false) Long priceMax,
            @RequestParam(required = false) List<String> sizes,
            @RequestParam(required = false) List<String> colors,
            @RequestParam(required = false, defaultValue = "false") boolean inStockOnly,
            Pageable pageable) {

        boolean hasAdvancedFilters = priceMin != null || priceMax != null
                                  || (sizes != null && !sizes.isEmpty())
                                  || (colors != null && !colors.isEmpty())
                                  || inStockOnly;

        boolean hasBasicFilters = (q != null && !q.isBlank()) || categoryId != null;

        if (hasAdvancedFilters) {
            return productService.listProductsAdvanced(
                ProductFilterRequest.builder()
                    .query(q)
                    .categoryId(categoryId)
                    .priceMin(priceMin)
                    .priceMax(priceMax)
                    .sizes(sizes)
                    .colors(colors)
                    .inStockOnly(inStockOnly)
                    .build(), pageable);
        }

        if (hasBasicFilters) {
            return productService.listProductsFiltered(categoryId, q, pageable);
        }

        return productService.listProducts(pageable);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable Long id) {
        return productService.getProduct(id);
    }

    @GetMapping("/slug/{slug}")
    public ProductResponse getBySlug(@PathVariable String slug) {
        return productService.getProductBySlug(slug);
    }

    @GetMapping("/category/{categoryId}")
    public Page<ProductResponse> listByCategory(@PathVariable Long categoryId, Pageable pageable) {
        return productService.listByCategory(categoryId, pageable);
    }

    @GetMapping("/search")
    public Page<ProductResponse> search(@RequestParam String q, Pageable pageable) {
        return productService.search(q, pageable);
    }

    /**
     * Returns full variant context needed by the customizer:
     * variant fields + parent product info + images + print area.
     * Covered by the existing "GET /api/products/**" public rule in SecurityConfig.
     */
    @GetMapping("/variants/{variantId}")
    public VariantDetailResponse getVariantDetail(@PathVariable Long variantId) {
        return productService.getVariantDetail(variantId);
    }

    @GetMapping("/autocomplete")
    public List<AutocompleteItem> autocomplete(@RequestParam String q) {
        return productService.autocomplete(q);
    }

    @GetMapping("/filter-options")
    public FilterOptionsResponse getFilterOptions(@RequestParam(required = false) Long categoryId) {
        return productService.getFilterOptions(categoryId);
    }

    @GetMapping("/{id}/recommendations")
    public List<ProductResponse> getRecommendations(@PathVariable Long id) {
        return productService.getRecommendations(id);
    }
}
