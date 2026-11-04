package com.tiendaropa.controller;

import com.tiendaropa.dto.request.CustomDesignRequest;
import com.tiendaropa.dto.response.CustomDesignResponse;
import com.tiendaropa.dto.response.UploadAssetResponse;
import com.tiendaropa.service.CustomDesignService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1/custom-designs")
@RequiredArgsConstructor
@Slf4j
public class CustomDesignController {

    private final CustomDesignService designService;

    /** Creates a new design in DRAFT status with an empty scene. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomDesignResponse create(Authentication auth, @Valid @RequestBody CustomDesignRequest request) {
        return designService.saveDesign((Long) auth.getPrincipal(), request);
    }

    /**
     * Uploads a single asset file to an existing design.
     * Returns the real database asset ID so the frontend can reference it
     * when submitting placement data in the subsequent PATCH call.
     */
    @PostMapping("/{designId}/assets")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadAssetResponse uploadAsset(Authentication auth,
                                           @PathVariable Long designId,
                                           @RequestParam("file") MultipartFile file) throws IOException {
        return designService.uploadAsset((Long) auth.getPrincipal(), designId, file);
    }

    /**
     * Updates the scene JSON (asset placements) of an existing design
     * and transitions its status from DRAFT → SAVED.
     * Called once after all assets have been uploaded.
     */
    @PatchMapping("/{designId}/scene")
    public CustomDesignResponse updateScene(Authentication auth,
                                            @PathVariable Long designId,
                                            @Valid @RequestBody SceneUpdateRequest body) {
        return designService.updateScene((Long) auth.getPrincipal(), designId,
                body.getAssets(), body.getTextLayers());
    }

    @GetMapping
    public List<CustomDesignResponse> list(Authentication auth) {
        return designService.getUserDesigns((Long) auth.getPrincipal());
    }

    @DeleteMapping("/{designId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable Long designId) {
        designService.deleteDesign((Long) auth.getPrincipal(), designId);
    }

    /** Request body for PATCH /{designId}/scene */
    @lombok.Data
    public static class SceneUpdateRequest {
        @Valid
        private List<CustomDesignRequest.AssetPlacement> assets;
        @Valid
        private List<CustomDesignRequest.TextLayer> textLayers;
    }
}
