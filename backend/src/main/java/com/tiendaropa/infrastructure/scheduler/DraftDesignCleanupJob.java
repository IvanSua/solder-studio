package com.tiendaropa.infrastructure.scheduler;

import com.tiendaropa.config.properties.DesignProperties;
import com.tiendaropa.entity.CustomDesign;
import com.tiendaropa.enums.DesignStatus;
import com.tiendaropa.repository.CustomDesignRepository;
import com.tiendaropa.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Scheduled job that removes stale DRAFT designs.
 *
 * <p>A DRAFT design is created when the user opens the customiser but
 * abandoned if they close the tab before finishing. Without cleanup,
 * these records and their associated files accumulate indefinitely.</p>
 *
 * <p>The job runs every hour and deletes DRAFT designs older than
 * {@code app.design.draft-expiry-hours} hours (default 2).
 * It also removes the associated files from object storage.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DraftDesignCleanupJob {

    private final CustomDesignRepository designRepository;
    private final StorageService storageService;
    private final DesignProperties designProperties;

    /**
     * Runs every hour at :00. The initial delay of 5 minutes avoids running
     * immediately on application startup during development restarts.
     */
    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT1H")
    @Transactional
    public void purgeAbandonedDrafts() {
        Instant cutoff = Instant.now().minus(designProperties.draftExpiryHours(), ChronoUnit.HOURS);
        List<CustomDesign> stale = designRepository.findByStatusAndCreatedAtBefore(
                DesignStatus.DRAFT, cutoff);

        if (stale.isEmpty()) {
            return;
        }

        log.info("DraftDesignCleanupJob: found {} stale DRAFT design(s) older than {} hours — purging",
                stale.size(), designProperties.draftExpiryHours());

        for (CustomDesign design : stale) {
            // Delete all asset files from object storage before removing the DB record
            design.getAssets().forEach(asset -> {
                tryDelete(asset.getOriginalFileUrl());
                tryDelete(asset.getNormalizedFileUrl());
            });
            designRepository.delete(design);
        }

        log.info("DraftDesignCleanupJob: purged {} stale DRAFT design(s)", stale.size());
    }

    private void tryDelete(String path) {
        if (path == null || path.isBlank()) return;
        try {
            storageService.delete(path);
        } catch (Exception ex) {
            // Log but do not fail the transaction — the DB record is more important to clean
            log.warn("DraftDesignCleanupJob: could not delete storage file '{}': {}", path, ex.getMessage());
        }
    }
}
