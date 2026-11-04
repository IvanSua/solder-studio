package com.tiendaropa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tiendaropa.dto.request.CustomDesignRequest;
import com.tiendaropa.dto.response.CustomDesignResponse;
import com.tiendaropa.entity.*;
import com.tiendaropa.enums.DesignStatus;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CustomDesignRepository;
import com.tiendaropa.repository.ProductVariantRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomDesignServiceTest {

    @Mock CustomDesignRepository designRepository;
    @Mock ProductVariantRepository variantRepository;
    @Mock UserRepository userRepository;
    @Mock StorageService storageService;
    @Mock DesignRenderService designRenderService;

    // ObjectMapper real — no hay lógica de red, solo serialización JSON
    ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks CustomDesignService customDesignService;

    private User user;
    private Product product;
    private PrintArea printArea;
    private ProductVariant variant;
    private CustomDesign savedDesign;

    @BeforeEach
    void setUp() {
        // Inject ObjectMapper manually since @InjectMocks won't pick it up as non-mock
        try {
            var field = CustomDesignService.class.getDeclaredField("objectMapper");
            field.setAccessible(true);
            field.set(customDesignService, objectMapper);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        printArea = PrintArea.builder()
                .id(1L)
                .canvasWidth(600).canvasHeight(600)
                .printableX(100).printableY(100)
                .printableWidth(400).printableHeight(400)
                .build();

        product = Product.builder()
                .id(1L).name("Remera").slug("remera")
                .images(new ArrayList<>()).variants(new ArrayList<>())
                .printArea(printArea)
                .build();
        printArea.setProduct(product);

        variant = ProductVariant.builder()
                .id(10L).product(product)
                .priceAmount(5000L).currencyCode("ARS")
                .color("Negro").size("M")
                .build();

        user = User.builder()
                .id(1L).email("ivan@test.com")
                .firstName("Ivan").lastName("S")
                .role(UserRole.CUSTOMER).enabled(true)
                .build();

        savedDesign = CustomDesign.builder()
                .id(1L).user(user).productVariant(variant)
                .status(DesignStatus.DRAFT).sceneJson("[]")
                .assets(new ArrayList<>())
                .build();
    }

    // ── saveDesign ─────────────────────────────────────────────────────────────

    @Nested
    class SaveDesign {

        @Test
        void sinAssets_creaDisenoDraft() {
            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(10L);
            req.setAssets(List.of());

            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(designRepository.save(any(CustomDesign.class))).thenReturn(savedDesign);

            CustomDesignResponse response = customDesignService.saveDesign(1L, req);

            assertThat(response.getDesignId()).isEqualTo(1L);
            assertThat(response.getStatus()).isEqualTo("draft");
        }

        @Test
        void assetDentroDelPrintArea_guardaExitosamente() {
            CustomDesignRequest.AssetPlacement placement = new CustomDesignRequest.AssetPlacement();
            placement.setAssetId(1L);
            placement.setX(200.0);  // dentro de [100, 500]
            placement.setY(300.0);  // dentro de [100, 500]
            placement.setScaleX(1.0);
            placement.setScaleY(1.0);
            placement.setRotation(0.0);
            placement.setZIndex(1);

            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(10L);
            req.setAssets(List.of(placement));

            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(designRepository.save(any(CustomDesign.class))).thenReturn(savedDesign);

            assertThatNoException().isThrownBy(() -> customDesignService.saveDesign(1L, req));
        }

        @Test
        void assetFueraDelPrintArea_lanzaBusinessException() {
            CustomDesignRequest.AssetPlacement placement = new CustomDesignRequest.AssetPlacement();
            placement.setAssetId(1L);
            placement.setX(50.0);   // fuera de [100, 500] — a la izquierda
            placement.setY(300.0);
            placement.setScaleX(1.0);
            placement.setScaleY(1.0);
            placement.setRotation(0.0);
            placement.setZIndex(1);

            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(10L);
            req.setAssets(List.of(placement));

            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> customDesignService.saveDesign(1L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("fuera del área imprimible");
        }

        @Test
        void assetFueraDelPrintAreaEnY_lanzaBusinessException() {
            CustomDesignRequest.AssetPlacement placement = new CustomDesignRequest.AssetPlacement();
            placement.setAssetId(1L);
            placement.setX(300.0);
            placement.setY(600.0);  // fuera del límite inferior (100+400=500)
            placement.setScaleX(1.0);
            placement.setScaleY(1.0);
            placement.setRotation(0.0);
            placement.setZIndex(1);

            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(10L);
            req.setAssets(List.of(placement));

            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> customDesignService.saveDesign(1L, req))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        void productoSinPrintArea_omiteLaValidacion() {
            product.setPrintArea(null);

            CustomDesignRequest.AssetPlacement placement = new CustomDesignRequest.AssetPlacement();
            placement.setAssetId(1L);
            placement.setX(0.0);    // estaría fuera si hubiera print area
            placement.setY(0.0);
            placement.setScaleX(1.0);
            placement.setScaleY(1.0);
            placement.setRotation(0.0);
            placement.setZIndex(1);

            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(10L);
            req.setAssets(List.of(placement));

            when(variantRepository.findById(10L)).thenReturn(Optional.of(variant));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(designRepository.save(any(CustomDesign.class))).thenReturn(savedDesign);

            assertThatNoException().isThrownBy(() -> customDesignService.saveDesign(1L, req));
        }

        @Test
        void variantNoEncontrada_lanzaResourceNotFoundException() {
            CustomDesignRequest req = new CustomDesignRequest();
            req.setProductVariantId(999L);

            when(variantRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> customDesignService.saveDesign(1L, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ── updateScene ────────────────────────────────────────────────────────────

    @Nested
    class UpdateScene {

        @Test
        void placementValido_actualizaSceneYCambiaSavedStatus() {
            CustomDesignRequest.AssetPlacement placement = new CustomDesignRequest.AssetPlacement();
            placement.setAssetId(1L);
            placement.setX(250.0);
            placement.setY(250.0);
            placement.setScaleX(1.0);
            placement.setScaleY(1.0);
            placement.setRotation(0.0);
            placement.setZIndex(1);

            CustomDesign updatedDesign = CustomDesign.builder()
                    .id(1L).user(user).productVariant(variant)
                    .status(DesignStatus.SAVED).sceneJson("{}")
                    .assets(new ArrayList<>())
                    .build();

            when(designRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(savedDesign));
            when(designRepository.save(any(CustomDesign.class))).thenReturn(updatedDesign);

            CustomDesignResponse response = customDesignService.updateScene(1L, 1L, List.of(placement), List.of());

            assertThat(response.getStatus()).isEqualTo("saved");
        }

        @Test
        void disenoNoEncontrado_lanzaResourceNotFoundException() {
            when(designRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> customDesignService.updateScene(1L, 99L, List.of(), List.of()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ── getUserDesigns ─────────────────────────────────────────────────────────

    @Nested
    class GetUserDesigns {

        @Test
        void retornaListaDeDisenosDelUsuario() {
            when(designRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(savedDesign));

            List<CustomDesignResponse> designs = customDesignService.getUserDesigns(1L);

            assertThat(designs).hasSize(1);
        }

        @Test
        void sinDisenos_retornaListaVacia() {
            when(designRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

            List<CustomDesignResponse> designs = customDesignService.getUserDesigns(1L);

            assertThat(designs).isEmpty();
        }
    }

    // ── deleteDesign ───────────────────────────────────────────────────────────

    @Nested
    class DeleteDesign {

        @Test
        void disenoExistente_loElimina() {
            when(designRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(savedDesign));

            assertThatNoException().isThrownBy(() -> customDesignService.deleteDesign(1L, 1L));

            verify(designRepository).delete(savedDesign);
        }

        @Test
        void disenoNoEncontrado_lanzaResourceNotFoundException() {
            when(designRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> customDesignService.deleteDesign(1L, 99L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
