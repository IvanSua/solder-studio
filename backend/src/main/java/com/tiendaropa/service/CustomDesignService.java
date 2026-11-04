package com.tiendaropa.service;

import com.tiendaropa.dto.request.CustomDesignRequest;
import com.tiendaropa.dto.response.CustomDesignResponse;
import com.tiendaropa.dto.response.UploadAssetResponse;
import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.entity.DesignAsset;
import com.tiendaropa.entity.PrintArea;
import com.tiendaropa.entity.Product;
import com.tiendaropa.entity.ProductVariant;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.DesignStatus;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CustomDesignRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.shared.util.FileTypeDetector;
import com.tiendaropa.config.properties.UploadProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomDesignService {

    private final CustomDesignRepository designRepository;
    private final ProductVariantRepository variantRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;
    private final DesignRenderService designRenderService;
    private final UploadProperties uploadProperties;

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/png", "image/jpeg", "image/webp");

    @Transactional
    public UploadAssetResponse uploadAsset(Long userId, Long designId, MultipartFile file) throws IOException {

        // ── 1. Size check (before reading everything into memory) ─────────────
        if (file.getSize() > uploadProperties.maxFileSizeBytes()) {
            throw new BusinessException("File exceeds maximum size of 10MB", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        // ── 2. Read bytes ONCE — reused for all subsequent checks ─────────────
        byte[] fileBytes = file.getBytes();

        // ── 3. MIME type via magic bytes (not the client-supplied Content-Type) ─
        byte[] header = Arrays.copyOf(fileBytes, Math.min(fileBytes.length, 16));
        String detectedMimeType = FileTypeDetector.detectMimeType(header);
        if (detectedMimeType == null || !ALLOWED_MIME_TYPES.contains(detectedMimeType)) {
            throw new BusinessException(
                    "Unsupported or invalid file type. Only PNG, JPEG and WebP are accepted.",
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        // ── 4. Decode the image and validate dimensions ────────────────────────
        // Note: Java's ImageIO does not support WebP natively. If decoding fails
        // but the magic-bytes check above passed, we accept the file as valid and
        // skip the resolution check (the frontend already enforces min-resolution
        // via the FileReader API before upload).
        BufferedImage image = null;
        try {
            image = ImageIO.read(new ByteArrayInputStream(fileBytes));
        } catch (Exception ignored) {
            // Some formats (e.g. WebP) may not be decodable by default ImageIO
        }

        if (image != null) {
            int maxDimension = Math.max(image.getWidth(), image.getHeight());
            if (maxDimension < uploadProperties.minResolutionAbsolute()) {
                throw new BusinessException(
                        "Image resolution too low. Minimum " + uploadProperties.minResolutionAbsolute() + "px required on longest side",
                        HttpStatus.UNPROCESSABLE_ENTITY);
            }
        }

        // ── 5. Load the design and check asset count ───────────────────────────
        CustomDesign design = designRepository.findByIdAndUserId(designId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Design not found"));

        if (design.getAssets().size() >= uploadProperties.maxFilesPerDesign()) {
            throw new BusinessException("Maximum " + uploadProperties.maxFilesPerDesign() + " files per design", HttpStatus.BAD_REQUEST);
        }

        // ── 6. SHA-256 hash (using already-read bytes — no second read) ────────
        String hash;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            hash = HexFormat.of().formatHex(digest.digest(fileBytes));
        } catch (Exception e) {
            throw new BusinessException("Failed to compute file hash", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // ── 7. Upload to object storage ────────────────────────────────────────
        String originalPath   = storageService.upload(file, "designs/" + designId + "/originals");
        // Normalized copy — currently same as original.
        // Future: strip EXIF metadata, convert to sRGB, etc.
        String normalizedPath = storageService.upload(file, "designs/" + designId + "/normalized");

        // ── 8. Persist asset ───────────────────────────────────────────────────
        DesignAsset asset = DesignAsset.builder()
                .customDesign(design)
                .originalFileUrl(originalPath)
                .normalizedFileUrl(normalizedPath)
                .widthPx(image != null ? image.getWidth() : 0)
                .heightPx(image != null ? image.getHeight() : 0)
                .mimeType(detectedMimeType)          // use detected type, not client header
                .fileSizeBytes(file.getSize())
                .fileHash(hash)
                .sortOrder(design.getAssets().size())
                .build();

        design.getAssets().add(asset);
        designRepository.save(design);

        // Flush so Hibernate assigns the generated ID to the asset before we return it.
        designRepository.flush();

        return UploadAssetResponse.builder()
                .assetId(asset.getId())
                .sortOrder(asset.getSortOrder())
                .build();
    }

    /**
     * Updates the scene JSON of an existing design (asset placements + optional text layers).
     * Called after all assets have been uploaded, replacing the first empty-scene save.
     * The scene is stored as { "assets": [...], "textLayers": [...] }.
     * Only the owner of the design can update it.
     */
    @Transactional
    public CustomDesignResponse updateScene(Long userId, Long designId,
                                            List<CustomDesignRequest.AssetPlacement> placements,
                                            List<CustomDesignRequest.TextLayer> textLayers) {
        CustomDesign design = designRepository.findByIdAndUserId(designId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Design not found"));

        String sceneJson;
        try {
            var scene = java.util.Map.of(
                    "assets", placements != null ? placements : java.util.List.of(),
                    "textLayers", textLayers != null ? textLayers : java.util.List.of()
            );
            sceneJson = objectMapper.writeValueAsString(scene);
        } catch (Exception e) {
            throw new BusinessException("Invalid scene data", HttpStatus.BAD_REQUEST);
        }

        // Validate placements are within the product's printable area
        ProductVariant sceneVariant = design.getProductVariant();
        if (sceneVariant != null && sceneVariant.getProduct() != null
                && sceneVariant.getProduct().getPrintArea() != null && placements != null) {
            validateAssetsWithinPrintArea(placements, sceneVariant.getProduct().getPrintArea());
        }

        design.setSceneJson(sceneJson);
        design.setStatus(DesignStatus.SAVED);
        design = designRepository.save(design);

        // Trigger async renders (non-blocking, run in parallel)
        designRenderService.generatePreview(design.getId());
        designRenderService.generateProductionRender(design.getId());

        return mapToResponse(design);
    }

    @Transactional
    public CustomDesignResponse saveDesign(Long userId, CustomDesignRequest request) {
        ProductVariant variant = variantRepository.findById(request.getProductVariantId())
                .orElseThrow(() -> new ResourceNotFoundException("Product variant not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Validate asset placements are within the product's printable area
        Product product = variant.getProduct();
        if (product != null && product.getPrintArea() != null && request.getAssets() != null) {
            validateAssetsWithinPrintArea(request.getAssets(), product.getPrintArea());
        }

        String sceneJson;
        try {
            sceneJson = objectMapper.writeValueAsString(request.getAssets());
        } catch (Exception e) {
            throw new BusinessException("Invalid scene data", HttpStatus.BAD_REQUEST);
        }

        CustomDesign design = CustomDesign.builder()
                .user(user)
                .productVariant(variant)
                .status(DesignStatus.DRAFT)   // DRAFT until assets are uploaded and scene is finalized
                .sceneJson(sceneJson)
                .build();

        design = designRepository.save(design);

        // Trigger async preview generation (non-blocking)
        designRenderService.generatePreview(design.getId());

        return mapToResponse(design);
    }

    @Transactional(readOnly = true)
    public List<CustomDesignResponse> getUserDesigns(Long userId) {
        return designRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public void deleteDesign(Long userId, Long designId) {
        CustomDesign design = designRepository.findByIdAndUserId(designId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Design not found"));
        designRepository.delete(design);
    }

    // ── Shared mapping ─────────────────────────────────────────────────────────

    private CustomDesignResponse mapToResponse(CustomDesign d) {
        var variant = d.getProductVariant();
        var product = variant != null ? variant.getProduct() : null;

        // Resolve primary product image URL
        String productImageUrl = null;
        if (product != null && product.getImages() != null) {
            product.getImages().stream()
                    .filter(img -> img.isPrimary())
                    .findFirst()
                    .or(() -> product.getImages().isEmpty() ? java.util.Optional.empty()
                            : java.util.Optional.of(product.getImages().get(0)))
                    .ifPresent(img -> {});
            var primaryOpt = product.getImages().stream().filter(img -> img.isPrimary()).findFirst();
            if (primaryOpt.isEmpty() && !product.getImages().isEmpty()) {
                primaryOpt = java.util.Optional.of(product.getImages().get(0));
            }
            if (primaryOpt.isPresent()) {
                productImageUrl = resolveImageUrl(primaryOpt.get().getImageUrl());
            }
        }

        return CustomDesignResponse.builder()
                .designId(d.getId())
                .status(d.getStatus().name().toLowerCase())
                .previewUrl(d.getPreviewUrl())
                .productionRenderUrl(d.getProductionRenderUrl())
                .variantId(variant != null ? variant.getId() : null)
                .variantColor(variant != null ? variant.getColor() : null)
                .variantSize(variant != null ? variant.getSize() : null)
                .productId(product != null ? product.getId() : null)
                .productName(product != null ? product.getName() : null)
                .productSlug(product != null ? product.getSlug() : null)
                .productImageUrl(productImageUrl)
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .build();
    }

    /**
     * Validates that each asset's anchor point (x, y) falls within the product's printable area.
     * Uses the anchor point only — the frontend enforces full bounding-box containment via canvas constraints.
     */
    private void validateAssetsWithinPrintArea(List<CustomDesignRequest.AssetPlacement> placements, PrintArea area) {
        double left   = area.getPrintableX();
        double top    = area.getPrintableY();
        double right  = left + area.getPrintableWidth();
        double bottom = top  + area.getPrintableHeight();

        for (int i = 0; i < placements.size(); i++) {
            CustomDesignRequest.AssetPlacement p = placements.get(i);
            if (p.getX() < left || p.getX() > right || p.getY() < top || p.getY() > bottom) {
                throw new BusinessException(
                        String.format(
                                "El asset %d tiene su punto de anclaje (%.0f, %.0f) fuera del área imprimible " +
                                "[x: %.0f–%.0f, y: %.0f–%.0f].",
                                i + 1, p.getX(), p.getY(), left, right, top, bottom),
                        HttpStatus.UNPROCESSABLE_ENTITY);
            }
        }
    }

    private String resolveImageUrl(String storedUrl) {
        if (storedUrl == null) return null;
        if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) return storedUrl;
        try { return storageService.getPresignedUrl(storedUrl); } catch (Exception e) { return storedUrl; }
    }
}
