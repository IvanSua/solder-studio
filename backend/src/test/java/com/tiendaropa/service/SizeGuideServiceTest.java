package com.tiendaropa.service;

import com.tiendaropa.dto.request.SizeGuideRequest;
import com.tiendaropa.dto.response.SizeGuideResponse;
import com.tiendaropa.entity.Category;
import com.tiendaropa.entity.SizeGuide;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CategoryRepository;
import com.tiendaropa.repository.SizeGuideRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SizeGuideServiceTest {

    @Mock
    private SizeGuideRepository sizeGuideRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @InjectMocks
    private SizeGuideService sizeGuideService;

    private Category buildCategory(Long id) {
        return Category.builder()
                .id(id)
                .name("Remeras")
                .slug("remeras")
                .build();
    }

    private SizeGuide buildGuide(Long id, Category category, boolean active) {
        return SizeGuide.builder()
                .id(id)
                .category(category)
                .name("Guía de talles para " + category.getName())
                .sizes(List.of("XS", "S", "M", "L", "XL"))
                .measurements(Map.of("S", Map.of("chest", "96")))
                .active(active)
                .build();
    }

    private SizeGuideRequest buildRequest(Long categoryId) {
        return SizeGuideRequest.builder()
                .categoryId(categoryId)
                .name("Nueva guía")
                .sizes(List.of("S", "M", "L"))
                .measurements(Map.of("S", Map.of("chest", "96", "waist", "74")))
                .instructions("Tomá las medidas con una cinta métrica.")
                .build();
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class GetById {

        @Test
        void retornaGuiaExistente() {
            Category category = buildCategory(1L);
            SizeGuide guide = buildGuide(1L, category, true);
            when(sizeGuideRepository.findById(1L)).thenReturn(Optional.of(guide));

            SizeGuideResponse resultado = sizeGuideService.getById(1L);

            assertThat(resultado.getId()).isEqualTo(1L);
            assertThat(resultado.getCategoryName()).isEqualTo("Remeras");
        }

        @Test
        void guiaNoEncontradaLanzaResourceNotFoundException() {
            when(sizeGuideRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> sizeGuideService.getById(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Guía de talles no encontrada");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class Create {

        @Test
        void creaGuiaConCategoria() {
            Category category = buildCategory(1L);
            SizeGuideRequest req = buildRequest(1L);
            when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
            SizeGuide saved = buildGuide(10L, category, true);
            when(sizeGuideRepository.save(any(SizeGuide.class))).thenReturn(saved);

            SizeGuideResponse resultado = sizeGuideService.create(req);

            assertThat(resultado.getCategoryId()).isEqualTo(1L);
            ArgumentCaptor<SizeGuide> captor = ArgumentCaptor.forClass(SizeGuide.class);
            verify(sizeGuideRepository).save(captor.capture());
            assertThat(captor.getValue().getName()).isEqualTo("Nueva guía");
            assertThat(captor.getValue().isActive()).isTrue();
        }

        @Test
        void categoriaNoEncontradaLanzaResourceNotFoundException() {
            SizeGuideRequest req = buildRequest(99L);
            when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> sizeGuideService.create(req))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Categoría no encontrada");

            verify(sizeGuideRepository, never()).save(any());
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class Update {

        @Test
        void actualizaCamposNoNulos() {
            Category category = buildCategory(1L);
            SizeGuide guide = buildGuide(1L, category, true);
            when(sizeGuideRepository.findById(1L)).thenReturn(Optional.of(guide));
            when(sizeGuideRepository.save(guide)).thenReturn(guide);

            SizeGuideRequest req = SizeGuideRequest.builder()
                    .name("Guía actualizada")
                    .build();

            sizeGuideService.update(1L, req);

            assertThat(guide.getName()).isEqualTo("Guía actualizada");
            verify(sizeGuideRepository).save(guide);
        }

        @Test
        void guiaNoEncontradaLanzaResourceNotFoundException() {
            when(sizeGuideRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> sizeGuideService.update(99L, buildRequest(1L)))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class Delete {

        @Test
        void softDeletePoneActivoEnFalse() {
            Category category = buildCategory(1L);
            SizeGuide guide = buildGuide(1L, category, true);
            when(sizeGuideRepository.findById(1L)).thenReturn(Optional.of(guide));

            sizeGuideService.delete(1L);

            assertThat(guide.isActive()).isFalse();
            verify(sizeGuideRepository).save(guide);
        }

        @Test
        void guiaNoEncontradaLanzaResourceNotFoundException() {
            when(sizeGuideRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> sizeGuideService.delete(99L))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
