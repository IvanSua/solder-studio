package com.tiendaropa.service;

import com.tiendaropa.dto.request.CreateProductRequest;
import com.tiendaropa.dto.request.CreateVariantRequest;
import com.tiendaropa.dto.request.UpdateProductRequest;
import com.tiendaropa.dto.request.ProductFilterRequest;
import com.tiendaropa.dto.response.ProductResponse;
import com.tiendaropa.dto.response.VariantDetailResponse;
import com.tiendaropa.dto.response.AutocompleteItem;
import com.tiendaropa.dto.response.CachedPage;
import com.tiendaropa.dto.response.FilterOptionsResponse;
import com.tiendaropa.entity.Category;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductImage;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import com.tiendaropa.repository.ProductImageRepository;
import com.tiendaropa.repository.ProductRepository;
import com.tiendaropa.repository.ProductSpecifications;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.shared.util.FileTypeDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductImageRepository productImageRepository;
    private final CategoryRepository categoryRepository;
    private final StorageService storageService;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

    /**
     * Self-injection via @Lazy so @Cacheable is honoured when called from within
     * this same class. Calling an annotated method directly (this.method()) bypasses
     * the Spring AOP proxy and the annotation is silently ignored — same rationale
     * as the self-injection pattern in DesignRenderService (see KI-001).
     */
    @Lazy
    @Autowired
    private ProductService self;

    @Transactional(readOnly = true)
    public ProductResponse getProduct(Long id) {
        Product product = productRepository.findByIdWithVariantsAndImages(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
        return mapToResponse(product);
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductBySlug(String slug) {
        Product product = productRepository.findBySlugWithVariants(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + slug));
        return mapToResponse(product);
    }

    // Cached via a serializable CachedPage<T> wrapper (see its Javadoc) instead of
    // annotating this method directly — Spring's PageImpl has no no-arg constructor,
    // so @Cacheable on a method returning Page<T> writes to Redis successfully but
    // can never be read back, silently degrading into a permanent cache miss on
    // every request. These are the two highest-traffic catalog-browsing endpoints,
    // so this matters most: previously every page view/pagination click/category
    // click hit Postgres directly with zero caching.
    @Transactional(readOnly = true)
    public Page<ProductResponse> listProducts(Pageable pageable) {
        return self.cachedListProducts(pageable).toPage(pageable);
    }

    // Key includes the sort spec, not just page/size — two requests for the same
    // page with different ?sort= query params are different result sets and must
    // not share a cache entry.
    @Cacheable(value = "productLists",
            key = "'all:' + #pageable.pageNumber + ':' + #pageable.pageSize + ':' + #pageable.sort")
    @Transactional(readOnly = true)
    public CachedPage<ProductResponse> cachedListProducts(Pageable pageable) {
        Page<ProductResponse> result = productRepository.findByActiveTrue(pageable).map(this::mapToResponse);
        return CachedPage.from(result);
    }

    @Transactional(readOnly = true)
    public Page<ProductResponse> listByCategory(Long categoryId, Pageable pageable) {
        return self.cachedListByCategory(categoryId, pageable).toPage(pageable);
    }

    @Cacheable(value = "productLists",
            key = "'cat:' + #categoryId + ':' + #pageable.pageNumber + ':' + #pageable.pageSize + ':' + #pageable.sort")
    @Transactional(readOnly = true)
    public CachedPage<ProductResponse> cachedListByCategory(Long categoryId, Pageable pageable) {
        Page<ProductResponse> result = productRepository.findByActiveTrueAndCategoryId(categoryId, pageable)
                .map(this::mapToResponse);
        return CachedPage.from(result);
    }

    /**
     * Unified catalog filter — all params optional.
     * Pass null to skip a filter; passing both null is equivalent to listProducts.
     */
    @Transactional(readOnly = true)
    public Page<ProductResponse> listProductsFiltered(Long categoryId, String query, Pageable pageable) {
        return productRepository
                .findFiltered(categoryId, query, pageable)
                .map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ProductResponse> search(String query, Pageable pageable) {
        return productRepository.search(query, pageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public List<AutocompleteItem> autocomplete(String q) {
        if (q == null || q.trim().length() < 2) return List.of();
        List<Product> products = productRepository.findAutocomplete(q.trim(), PageRequest.of(0, 8));
        return products.stream().map(p -> {
            String imageUrl = p.getImages().stream()
                .filter(ProductImage::isPrimary).findFirst()
                .or(() -> p.getImages().stream().findFirst())
                .map(ProductImage::getImageUrl).orElse(null);
            Long minPrice = p.getVariants().stream()
                .filter(ProductVariant::isActive)
                .mapToLong(ProductVariant::getPriceAmount)
                .min().orElse(0L);
            String currency = p.getVariants().stream()
                .filter(ProductVariant::isActive)
                .map(ProductVariant::getCurrencyCode)
                .findFirst().orElse("ARS");
            return AutocompleteItem.builder()
                .productId(p.getId())
                .name(p.getName())
                .slug(p.getSlug())
                .imageUrl(imageUrl)
                .minPriceAmount(minPrice)
                .currencyCode(currency)
                .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<ProductResponse> listProductsAdvanced(ProductFilterRequest filter, Pageable pageable) {
        return productRepository
                .findAll(ProductSpecifications.withFilter(filter), pageable)
                .map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public FilterOptionsResponse getFilterOptions(Long categoryId) {
        // For now ignore categoryId filtering on options (can be enhanced later)
        return FilterOptionsResponse.builder()
            .sizes(productRepository.findDistinctSizes())
            .colors(productRepository.findDistinctColors())
            .minPrice(productRepository.findMinPrice())
            .maxPrice(productRepository.findMaxPrice())
            .build();
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> getRecommendations(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        List<Product> recommendations = new java.util.ArrayList<>();

        // 1. Frequently Bought Together (up to 4)
        try {
            List<Product> boughtTogether = productRepository.findFrequentlyBoughtTogether(
                    productId, PageRequest.of(0, 4));
            if (!boughtTogether.isEmpty()) {
                recommendations.addAll(boughtTogether);
            }
        } catch (Exception e) {
            // If co-purchase query fails (e.g., not enough data), fall back silently
            log.debug("Could not fetch frequently bought together for product {}: {}", productId, e.getMessage());
        }

        // 2. Fill remaining slots with category-based recommendations (up to 6 total)
        if (recommendations.size() < 6) {
            List<Product> categoryBased;
            if (product.getCategory() != null) {
                categoryBased = productRepository.findRelatedByCategory(
                        product.getCategory(), productId, PageRequest.of(0, 6 - recommendations.size()));
            } else {
                categoryBased = productRepository.findAll(PageRequest.of(0, 6)).getContent().stream()
                        .filter(p -> !p.getId().equals(productId) && p.isActive())
                        .limit(6 - recommendations.size())
                        .collect(Collectors.toList());
            }

            // Add only products not already in recommendations
            Set<Long> existingIds = recommendations.stream()
                    .map(Product::getId)
                    .collect(Collectors.toSet());
            categoryBased.stream()
                    .filter(p -> !existingIds.contains(p.getId()))
                    .forEach(recommendations::add);
        }

        return recommendations.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    // ── Image management ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProductResponse.ImageResponse> getProductImages(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new ResourceNotFoundException("Product not found: " + productId);
        }
        return productImageRepository.findByProductIdOrderBySortOrderAsc(productId)
                .stream()
                .map(img -> ProductResponse.ImageResponse.builder()
                        .id(img.getId())
                        .imageUrl(resolveImageUrl(img.getImageUrl()))
                        .altText(img.getAltText())
                        .primary(img.isPrimary())
                        .build())
                .toList();
    }

    /**
     * Converts a stored image URL to a displayable URL.
     * - If already an absolute HTTP(S) URL (e.g. placeholder), return as-is.
     * - Otherwise treat as a MinIO object path and generate a presigned URL.
     */
    private String resolveImageUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
            return storedUrl;
        }
        try {
            return storageService.getPresignedUrl(storedUrl);
        } catch (Exception e) {
            return storedUrl; // fallback: return path as-is
        }
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse.ImageResponse uploadProductImage(
            Long productId, MultipartFile file, String altText, boolean setPrimary) throws IOException {

        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new BusinessException("Image exceeds 10MB maximum", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        // Validate the real file type by magic bytes — the client-supplied Content-Type
        // header is not trustworthy (can be spoofed to bypass the extension check).
        byte[] fileBytes = file.getBytes();
        byte[] header = Arrays.copyOf(fileBytes, Math.min(fileBytes.length, 16));
        String detectedMimeType = FileTypeDetector.detectMimeType(header);
        if (detectedMimeType == null || !ALLOWED_IMAGE_TYPES.contains(detectedMimeType)) {
            throw new BusinessException("Only JPEG, PNG and WebP images are accepted", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));

        // Determine sort order (append at end)
        List<ProductImage> existing = productImageRepository.findByProductIdOrderBySortOrderAsc(productId);
        int sortOrder = existing.size();

        // If this is the first image or caller wants it primary, clear existing primary flag
        boolean makePrimary = setPrimary || existing.isEmpty();
        if (makePrimary) {
            productImageRepository.clearPrimaryForProduct(productId);
        }

        String storagePath = storageService.upload(file, "products/" + productId + "/images");

        ProductImage image = ProductImage.builder()
                .product(product)
                .imageUrl(storagePath)
                .altText(altText)
                .sortOrder(sortOrder)
                .primary(makePrimary)
                .build();

        image = productImageRepository.save(image);

        return ProductResponse.ImageResponse.builder()
                .id(image.getId())
                .imageUrl(image.getImageUrl())
                .altText(image.getAltText())
                .primary(image.isPrimary())
                .build();
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public void deleteProductImage(Long productId, Long imageId) {
        ProductImage image = productImageRepository.findByIdAndProductId(imageId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found"));

        boolean wasPrimary = image.isPrimary();
        productImageRepository.delete(image);

        // If the deleted image was primary, promote the next image in sort order
        if (wasPrimary) {
            productImageRepository.findByProductIdOrderBySortOrderAsc(productId)
                    .stream()
                    .findFirst()
                    .ifPresent(next -> {
                        next.setPrimary(true);
                        productImageRepository.save(next);
                    });
        }

        storageService.delete(image.getImageUrl());
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse.ImageResponse setImageAsPrimary(Long productId, Long imageId) {
        ProductImage image = productImageRepository.findByIdAndProductId(imageId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found"));
        productImageRepository.clearPrimaryForProduct(productId);
        image.setPrimary(true);
        productImageRepository.save(image);
        return ProductResponse.ImageResponse.builder()
                .id(image.getId())
                .imageUrl(image.getImageUrl())
                .altText(image.getAltText())
                .primary(true)
                .build();
    }

    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public void evictProductCaches() {
        // triggered on product update by admin
    }

    // ── Admin methods ─────────────────────────────────────────────────────────

    /** List ALL products, including inactive ones (admin view) */
    @Transactional(readOnly = true)
    public Page<ProductResponse> listAllProducts(Pageable pageable) {
        return productRepository.findAll(pageable).map(this::mapToResponse);
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse setProductActive(Long productId, boolean active) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));
        product.setActive(active);
        return mapToResponse(productRepository.save(product));
    }

    /**
     * Returns full variant context for the customizer in a single DB round-trip.
     * Includes variant fields, parent product info, product images, and print area.
     */
    @Transactional(readOnly = true)
    public VariantDetailResponse getVariantDetail(Long variantId) {
        ProductVariant variant = productVariantRepository
                .findByIdWithProductDetails(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variant not found: " + variantId));

        Product product = variant.getProduct();

        var images = product.getImages().stream()
                .map(img -> ProductResponse.ImageResponse.builder()
                        .id(img.getId())
                        .imageUrl(img.getImageUrl())
                        .altText(img.getAltText())
                        .primary(img.isPrimary())
                        .build())
                .toList();

        ProductResponse.PrintAreaResponse printAreaResponse = null;
        if (product.getPrintArea() != null) {
            var pa = product.getPrintArea();
            printAreaResponse = ProductResponse.PrintAreaResponse.builder()
                    .canvasWidth(pa.getCanvasWidth())
                    .canvasHeight(pa.getCanvasHeight())
                    .printableX(pa.getPrintableX())
                    .printableY(pa.getPrintableY())
                    .printableWidth(pa.getPrintableWidth())
                    .printableHeight(pa.getPrintableHeight())
                    .build();
        }

        return VariantDetailResponse.builder()
                .variantId(variant.getId())
                .color(variant.getColor())
                .size(variant.getSize())
                .priceAmount(variant.getPriceAmount())
                .currencyCode(variant.getCurrencyCode())
                .stockAvailable(variant.getStockAvailable())
                .sku(variant.getSku())
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .customizable(product.isCustomizable())
                .images(images)
                .printArea(printAreaResponse)
                .build();
    }

    // ── Create / Update product ───────────────────────────────────────────────

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse createProduct(CreateProductRequest request) {
        String slug = resolveSlug(request.getSlug(), request.getName());
        if (productRepository.existsBySlug(slug)) {
            throw new BusinessException("Slug '" + slug + "' already in use", HttpStatus.CONFLICT);
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + request.getCategoryId()));
        }

        Product product = Product.builder()
                .name(request.getName())
                .slug(slug)
                .description(request.getDescription())
                .category(category)
                .customizable(request.isCustomizable())
                .active(request.isActive())
                .build();

        return mapToResponse(productRepository.save(product));
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse updateProduct(Long productId, UpdateProductRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));

        if (request.getName() != null && !request.getName().isBlank()) {
            product.setName(request.getName());
        }
        if (request.getSlug() != null && !request.getSlug().isBlank()) {
            String newSlug = toSlug(request.getSlug());
            if (!newSlug.equals(product.getSlug()) && productRepository.existsBySlug(newSlug)) {
                throw new BusinessException("Slug '" + newSlug + "' already in use", HttpStatus.CONFLICT);
            }
            product.setSlug(newSlug);
        }
        if (request.getDescription() != null) {
            product.setDescription(request.getDescription());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + request.getCategoryId()));
            product.setCategory(category);
        }
        if (request.getCustomizable() != null) {
            product.setCustomizable(request.getCustomizable());
        }
        if (request.getActive() != null) {
            product.setActive(request.getActive());
        }

        return mapToResponse(productRepository.save(product));
    }

    // ── Variant management ────────────────────────────────────────────────────

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public ProductResponse.VariantResponse addVariant(Long productId, CreateVariantRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));

        // Enforce unique (product_id, color, size) at service level for a cleaner error
        boolean duplicate = productVariantRepository.existsByProductIdAndColorAndSize(
                productId, request.getColor(), request.getSize());
        if (duplicate) {
            throw new BusinessException(
                    "Variant " + request.getColor() + "/" + request.getSize() + " already exists",
                    HttpStatus.CONFLICT);
        }

        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .color(request.getColor())
                .size(request.getSize())
                .priceAmount(request.getPriceAmount())
                .stockTotal(request.getStockTotal())
                .sku(request.getSku())
                .build();

        variant = productVariantRepository.save(variant);

        return ProductResponse.VariantResponse.builder()
                .id(variant.getId())
                .color(variant.getColor())
                .size(variant.getSize())
                .priceAmount(variant.getPriceAmount())
                .currencyCode(variant.getCurrencyCode())
                .stockAvailable(variant.getStockAvailable())
                .stockTotal(variant.getStockTotal())
                .stockReserved(variant.getStockReserved())
                .sku(variant.getSku())
                .build();
    }

    @Transactional
    @CacheEvict(value = {"products", "productLists"}, allEntries = true)
    public void deleteVariant(Long productId, Long variantId) {
        ProductVariant variant = productVariantRepository.findById(variantId)
                .orElseThrow(() -> new ResourceNotFoundException("Variant not found: " + variantId));
        if (!variant.getProduct().getId().equals(productId)) {
            throw new ResourceNotFoundException("Variant not found for product: " + productId);
        }
        // Soft-delete: mark inactive rather than removing (preserves order history)
        variant.setActive(false);
        productVariantRepository.save(variant);
    }

    // ── Slug helpers ──────────────────────────────────────────────────────────

    private String resolveSlug(String providedSlug, String name) {
        if (providedSlug != null && !providedSlug.isBlank()) {
            return toSlug(providedSlug);
        }
        return toSlug(name);
    }

    private String toSlug(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        return normalized
                .replaceAll("\\p{M}", "")        // strip accent marks
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")    // non-alphanumeric → hyphen
                .replaceAll("^-|-$", "");          // trim leading/trailing hyphens
    }

    private ProductResponse mapToResponse(Product product) {
        var variants = product.getVariants().stream()
                .filter(v -> v.isActive())
                .map(v -> ProductResponse.VariantResponse.builder()
                        .id(v.getId())
                        .color(v.getColor())
                        .size(v.getSize())
                        .priceAmount(v.getPriceAmount())
                        .currencyCode(v.getCurrencyCode())
                        .stockAvailable(v.getStockAvailable())
                        .stockTotal(v.getStockTotal())
                        .stockReserved(v.getStockReserved())
                        .sku(v.getSku())
                        .build())
                .toList();

        var images = product.getImages().stream()
                .map(img -> ProductResponse.ImageResponse.builder()
                        .id(img.getId())
                        .imageUrl(img.getImageUrl())
                        .altText(img.getAltText())
                        .primary(img.isPrimary())
                        .build())
                .toList();

        ProductResponse.PrintAreaResponse printAreaResponse = null;
        if (product.getPrintArea() != null) {
            var pa = product.getPrintArea();
            printAreaResponse = ProductResponse.PrintAreaResponse.builder()
                    .canvasWidth(pa.getCanvasWidth())
                    .canvasHeight(pa.getCanvasHeight())
                    .printableX(pa.getPrintableX())
                    .printableY(pa.getPrintableY())
                    .printableWidth(pa.getPrintableWidth())
                    .printableHeight(pa.getPrintableHeight())
                    .build();
        }

        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .slug(product.getSlug())
                .description(product.getDescription())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .customizable(product.isCustomizable())
                .active(product.isActive())
                .variants(variants)
                .images(images)
                .printArea(printAreaResponse)
                .build();
    }
}
