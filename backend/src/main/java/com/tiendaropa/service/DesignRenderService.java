package com.tiendaropa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.entity.DesignAsset;
import com.tiendaropa.enums.DesignStatus;
import com.tiendaropa.repository.CustomDesignRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DesignRenderService {

    private final CustomDesignRepository designRepository;
    private final StorageService storageService;

    /**
     * Self-injection via @Lazy to allow @Transactional proxy to be called from
     * within an @Async method. Without this, calling a @Transactional method
     * directly (this.method()) bypasses the Spring proxy and the transaction
     * never starts.
     */
    @Lazy
    @Autowired
    private DesignRenderService self;

    /**
     * Async task — triggered after a design is saved.
     * Downloads each uploaded asset from storage, composites them on a canvas
     * (using Java AWT Graphics2D), and uploads the result as a preview PNG.
     * Updates design.previewUrl on completion.
     *
     * If image decoding fails (e.g. WebP), that asset is skipped — the preview
     * is still generated with whatever assets could be decoded.
     *
     * NOTE: @Transactional removed intentionally. Combining @Async + @Transactional
     * on the same method is unsafe: the async thread may run before the caller's
     * transaction commits, causing findById to return stale/missing data. DB access
     * is handled via self.loadDesignData() and self.persistPreviewResult() which
     * each open their own short-lived transaction via the Spring proxy.
     */
    @Async("designRenderExecutor")
    public void generatePreview(Long designId) {
        CustomDesign design = self.loadDesignData(designId);
        if (design == null) {
            log.warn("generatePreview: design {} not found", designId);
            return;
        }

        List<DesignAsset> assets = design.getAssets();
        if (assets.isEmpty()) {
            log.debug("generatePreview: design {} has no assets, skipping", designId);
            return;
        }

        try {
            // Canvas size from product's print area if available, otherwise 600x600
            int canvasW = 600, canvasH = 600;
            if (design.getProductVariant() != null
                    && design.getProductVariant().getProduct() != null
                    && design.getProductVariant().getProduct().getPrintArea() != null) {
                var pa = design.getProductVariant().getProduct().getPrintArea();
                canvasW = pa.getCanvasWidth();
                canvasH = pa.getCanvasHeight();
            }

            BufferedImage canvas = new BufferedImage(canvasW, canvasH, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g2d = canvas.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

            // Sort assets by sortOrder
            assets.stream()
                  .sorted(Comparator.comparingInt(DesignAsset::getSortOrder))
                  .forEach(asset -> renderAsset(g2d, asset, design));

            g2d.dispose();

            // Encode to PNG bytes
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(canvas, "PNG", baos);
            byte[] pngBytes = baos.toByteArray();

            // Upload to storage
            String objectName = "designs/" + designId + "/preview.png";
            String previewUrl = storageService.uploadBytes(pngBytes, objectName, "image/png");

            // Persist result via proxy to ensure @Transactional is honoured
            self.persistPreviewResult(designId, previewUrl);
            log.info("Preview generated for design {}: {}", designId, previewUrl);

        } catch (Exception e) {
            log.error("Failed to generate preview for design {}: {}", designId, e.getMessage(), e);
            // Non-fatal — design is still usable without preview
        }
    }

    /**
     * Loads design and eagerly initializes all lazy associations needed for rendering.
     * Must be called via the Spring proxy (self.loadDesignData) so that the
     * @Transactional boundary is active when Hibernate accesses lazy collections.
     */
    @Transactional(readOnly = true)
    public CustomDesign loadDesignData(Long designId) {
        return designRepository.findById(designId)
                .map(design -> {
                    Hibernate.initialize(design.getAssets());
                    if (design.getProductVariant() != null) {
                        Hibernate.initialize(design.getProductVariant());
                        if (design.getProductVariant().getProduct() != null) {
                            Hibernate.initialize(design.getProductVariant().getProduct());
                        }
                    }
                    return design;
                })
                .orElse(null);
    }

    /**
     * Persists the preview URL after rendering completes.
     * Status is intentionally NOT updated here — it is managed by generateProductionRender.
     * Called via self to ensure the @Transactional proxy is active.
     */
    @Transactional
    public void persistPreviewResult(Long designId, String previewUrl) {
        designRepository.findById(designId).ifPresent(design ->
            design.setPreviewUrl(previewUrl));
    }

    /**
     * Async task — triggered after a design is finalized (SAVED status).
     * Generates a high-resolution production PNG (3× base canvas) for printing.
     * Manages the full status lifecycle: SAVED → RENDERING → READY (or FAILED).
     *
     * Same @Async + self-injection pattern as generatePreview — see that method's
     * comment for the rationale.
     */
    @Async("designRenderExecutor")
    public void generateProductionRender(Long designId) {
        CustomDesign design = self.loadDesignData(designId);
        if (design == null) {
            log.warn("generateProductionRender: design {} not found", designId);
            return;
        }
        if (design.getAssets().isEmpty()) {
            log.debug("generateProductionRender: design {} has no assets, skipping", designId);
            return;
        }

        self.setStatusRendering(designId);

        try {
            int baseW = 600, baseH = 600;
            if (design.getProductVariant() != null
                    && design.getProductVariant().getProduct() != null
                    && design.getProductVariant().getProduct().getPrintArea() != null) {
                var pa = design.getProductVariant().getProduct().getPrintArea();
                baseW = pa.getCanvasWidth();
                baseH = pa.getCanvasHeight();
            }
            // 3× scale for print-quality output (~300 DPI equivalent)
            int canvasW = baseW * 3;
            int canvasH = baseH * 3;

            BufferedImage canvas = new BufferedImage(canvasW, canvasH, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g2d = canvas.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING,     RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING,  RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g2d.scale(3.0, 3.0);  // scale the coordinate space so renderAsset coords match 1× scene

            design.getAssets().stream()
                  .sorted(Comparator.comparingInt(DesignAsset::getSortOrder))
                  .forEach(asset -> renderAsset(g2d, asset, design));

            g2d.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(canvas, "PNG", baos);
            byte[] pngBytes = baos.toByteArray();

            String objectName = "designs/" + designId + "/production-render.png";
            String productionUrl = storageService.uploadBytes(pngBytes, objectName, "image/png");

            self.persistProductionResult(designId, productionUrl);
            log.info("Production render generated for design {}: {}", designId, productionUrl);

        } catch (Exception e) {
            log.error("Failed to generate production render for design {}: {}", designId, e.getMessage(), e);
            self.persistProductionFailure(designId);
        }
    }

    @Transactional
    public void setStatusRendering(Long designId) {
        designRepository.findById(designId).ifPresent(design ->
            design.setStatus(DesignStatus.RENDERING));
    }

    @Transactional
    public void persistProductionResult(Long designId, String productionRenderUrl) {
        designRepository.findById(designId).ifPresent(design -> {
            design.setProductionRenderUrl(productionRenderUrl);
            design.setStatus(DesignStatus.READY);
        });
    }

    @Transactional
    public void persistProductionFailure(Long designId) {
        designRepository.findById(designId).ifPresent(design ->
            design.setStatus(DesignStatus.FAILED));
    }

    private void renderAsset(Graphics2D g2d, DesignAsset asset, CustomDesign design) {
        // Parse placement from sceneJson to get x, y, scaleX, scaleY, rotation
        // Fallback: render at center if no placement data
        double x = 0, y = 0, scaleX = 1.0, scaleY = 1.0, rotation = 0;

        if (design.getSceneJson() != null) {
            try {
                // Parse the sceneJson — format is either:
                // array of placements: [{"assetId":1,"x":200,"y":300,"scaleX":1.0,...}]
                // or object: {"assets":[...],"textLayers":[...]}
                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(design.getSceneJson());
                JsonNode placements = root.isArray() ? root : root.path("assets");
                for (JsonNode p : placements) {
                    if (p.path("assetId").asLong(-1) == asset.getId()) {
                        x        = p.path("x").asDouble(0);
                        y        = p.path("y").asDouble(0);
                        scaleX   = p.path("scaleX").asDouble(1.0);
                        scaleY   = p.path("scaleY").asDouble(1.0);
                        rotation = p.path("rotation").asDouble(0);
                        break;
                    }
                }
            } catch (Exception e) {
                log.debug("Could not parse sceneJson for asset {}: {}", asset.getId(), e.getMessage());
            }
        }

        try {
            byte[] bytes = storageService.downloadBytes(asset.getNormalizedFileUrl());
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null) {
                log.debug("Could not decode image for asset {} (possibly WebP)", asset.getId());
                return;
            }

            AffineTransform transform = new AffineTransform();
            transform.translate(x, y);
            if (rotation != 0) {
                transform.rotate(Math.toRadians(rotation), img.getWidth() * scaleX / 2, img.getHeight() * scaleY / 2);
            }
            transform.scale(scaleX, scaleY);

            g2d.drawImage(img, transform, null);
        } catch (Exception e) {
            log.warn("Failed to render asset {} for design {}: {}", asset.getId(), design.getId(), e.getMessage());
        }
    }
}
