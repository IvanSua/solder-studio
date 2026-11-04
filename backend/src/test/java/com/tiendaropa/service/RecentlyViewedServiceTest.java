package com.tiendaropa.service;

import com.tiendaropa.entity.RecentlyViewed;
import com.tiendaropa.repository.RecentlyViewedRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecentlyViewedServiceTest {

    @Mock RecentlyViewedRepository recentlyViewedRepo;
    @Mock ProductService productService;

    @InjectMocks RecentlyViewedService recentlyViewedService;

    // ── recordView ────────────────────────────────────────────────────────────

    @Nested
    class RecordView {

        @Test
        void updatesViewedAtWhenEntryAlreadyExists() {
            RecentlyViewed existing = RecentlyViewed.builder()
                    .id(1L).userId(10L).productId(5L)
                    .viewedAt(Instant.now().minusSeconds(3600))
                    .build();

            when(recentlyViewedRepo.findByUserIdAndProductId(10L, 5L))
                    .thenReturn(Optional.of(existing));

            recentlyViewedService.recordView(10L, 5L);

            assertThat(existing.getViewedAt()).isAfter(Instant.now().minusSeconds(10));
            verify(recentlyViewedRepo).save(existing);
            // No eviction when updating — count is not checked
            verify(recentlyViewedRepo, never()).countByUserId(anyLong());
        }

        @Test
        void savesNewEntryWhenNotExists() {
            when(recentlyViewedRepo.findByUserIdAndProductId(10L, 7L))
                    .thenReturn(Optional.empty());
            when(recentlyViewedRepo.countByUserId(10L)).thenReturn(5L); // below limit

            recentlyViewedService.recordView(10L, 7L);

            ArgumentCaptor<RecentlyViewed> captor = ArgumentCaptor.forClass(RecentlyViewed.class);
            verify(recentlyViewedRepo).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo(10L);
            assertThat(captor.getValue().getProductId()).isEqualTo(7L);
        }

        @Test
        void evictsOldestEntriesWhenOverLimit() {
            when(recentlyViewedRepo.findByUserIdAndProductId(10L, 99L))
                    .thenReturn(Optional.empty());
            // 21 entries — 1 over MAX_RECENTLY_VIEWED (20)
            when(recentlyViewedRepo.countByUserId(10L)).thenReturn(21L);

            recentlyViewedService.recordView(10L, 99L);

            verify(recentlyViewedRepo).deleteOldestForUser(10L, 1L);
        }

        @Test
        void doesNotEvictWhenExactlyAtLimit() {
            when(recentlyViewedRepo.findByUserIdAndProductId(10L, 99L))
                    .thenReturn(Optional.empty());
            when(recentlyViewedRepo.countByUserId(10L)).thenReturn(20L); // exactly at limit

            recentlyViewedService.recordView(10L, 99L);

            verify(recentlyViewedRepo, never()).deleteOldestForUser(anyLong(), anyLong());
        }
    }

    // ── getRecentlyViewed ─────────────────────────────────────────────────────

    @Nested
    class GetRecentlyViewed {

        @Test
        void usesExcludingQueryWhenExcludeIdProvided() {
            when(recentlyViewedRepo.findRecentByUserIdExcluding(eq(1L), eq(5L), any()))
                    .thenReturn(java.util.List.of());

            recentlyViewedService.getRecentlyViewed(1L, 5L);

            verify(recentlyViewedRepo).findRecentByUserIdExcluding(eq(1L), eq(5L),
                    eq(PageRequest.of(0, 10)));
            verify(recentlyViewedRepo, never()).findRecentByUserId(anyLong(), any());
        }

        @Test
        void usesStandardQueryWhenExcludeIdIsNull() {
            when(recentlyViewedRepo.findRecentByUserId(eq(1L), any()))
                    .thenReturn(java.util.List.of());

            recentlyViewedService.getRecentlyViewed(1L, null);

            verify(recentlyViewedRepo).findRecentByUserId(eq(1L), eq(PageRequest.of(0, 10)));
            verify(recentlyViewedRepo, never()).findRecentByUserIdExcluding(anyLong(), anyLong(), any());
        }
    }
}
