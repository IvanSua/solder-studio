package com.tiendaropa.service;

import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.entity.DesignAsset;
import com.tiendaropa.enums.DesignStatus;
import com.tiendaropa.repository.CustomDesignRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DesignRenderServiceTest {

    @Mock CustomDesignRepository designRepository;
    @Mock StorageService storageService;

    @InjectMocks DesignRenderService designRenderService;

    private CustomDesign designWithNoAssets;
    private CustomDesign designWithAssets;
    private DesignAsset asset;

    @BeforeEach
    void setUp() {
        // Self-injection: DesignRenderService uses @Lazy @Autowired DesignRenderService self
        // for @Async/@Transactional proxy calls. In unit tests we bypass the proxy and
        // point self directly to the same instance.
        ReflectionTestUtils.setField(designRenderService, "self", designRenderService);

        designWithNoAssets = CustomDesign.builder()
                .id(1L)
                .status(DesignStatus.DRAFT)
                .assets(new ArrayList<>())
                .build();

        asset = DesignAsset.builder()
                .id(10L)
                .normalizedFileUrl("designs/2/normalized/file.png")
                .widthPx(200)
                .heightPx(200)
                .mimeType("image/png")
                .sortOrder(0)
                .build();

        designWithAssets = CustomDesign.builder()
                .id(2L)
                .status(DesignStatus.DRAFT)
                .sceneJson("[{\"assetId\":10,\"x\":0,\"y\":0,\"scaleX\":1.0,\"scaleY\":1.0,\"rotation\":0}]")
                .assets(new ArrayList<>(List.of(asset)))
                .build();
    }

    // ── design not found ───────────────────────────────────────────────────────

    @Nested
    class CuandoElDisenoNoExiste {

        @Test
        void noLanzaExcepcionYNoInteractuaConStorage() {
            when(designRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatNoException().isThrownBy(() -> designRenderService.generatePreview(99L));

            verifyNoInteractions(storageService);
        }
    }

    // ── design with no assets ──────────────────────────────────────────────────

    @Nested
    class CuandoElDisenoNoTieneAssets {

        @Test
        void saltaLaGeneracionSinErrores() {
            when(designRepository.findById(1L)).thenReturn(Optional.of(designWithNoAssets));

            assertThatNoException().isThrownBy(() -> designRenderService.generatePreview(1L));

            verifyNoInteractions(storageService);
        }

        @Test
        void noGuardaElDiseno() {
            when(designRepository.findById(1L)).thenReturn(Optional.of(designWithNoAssets));

            designRenderService.generatePreview(1L);

            verify(designRepository, never()).save(any());
        }
    }

    // ── download failure ───────────────────────────────────────────────────────

    @Nested
    class CuandoLaDescargaFalla {

        @Test
        void noLanzaExcepcionAlTopLevel() {
            when(designRepository.findById(2L)).thenReturn(Optional.of(designWithAssets));
            when(storageService.downloadBytes(any())).thenThrow(new RuntimeException("MinIO unavailable"));

            // Must NOT propagate — design still usable without preview
            assertThatNoException().isThrownBy(() -> designRenderService.generatePreview(2L));
        }

        @Test
        void noActualizaElPreviewUrl() {
            when(designRepository.findById(2L)).thenReturn(Optional.of(designWithAssets));
            when(storageService.downloadBytes(any())).thenThrow(new RuntimeException("MinIO unavailable"));

            designRenderService.generatePreview(2L);

            // save() may or may not be called depending on where the failure occurs,
            // but previewUrl must remain null (not set to a bad value)
            assertThat(designWithAssets.getPreviewUrl()).isNull();
        }
    }
}
