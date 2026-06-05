import { deduplicateRecords } from "@/lib/deduplication";
import { logger } from "@/lib/logger";
import { US_STATE_CODES } from "@/lib/us-states";
import type { DiscoveryProgressRepository } from "@/repositories/discovery-progress.repository";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { NpiService } from "@/services/npi/npi.service";
import type { DiscoveryResult } from "@/services/discovery/discovery.service";
import type { NormalizedPhysicianInput } from "@/types";

const NPI_PAGE_SIZE = 200;
const MAX_API_PAGES_PER_RUN = 20;
/** Per-run cap on NPI lookups when refreshing existing records (avoids timeout). */
const REFRESH_PER_RUN = 50;

export interface UsGrowthDiscoveryOptions {
  targetNew?: number;
}

export type UsGrowthDiscoveryResult = DiscoveryResult & {
  mode: "new_leads" | "refresh_fallback";
  pages_scanned: number;
  refresh_target: number;
};

/**
 * US-wide discovery that prioritizes NEW cardiologists:
 * 1. Rotate through all states with NPI skip pagination
 * 2. Only insert physicians whose NPI is not already in the database
 * 3. When a full US lap finds zero new NPIs, refresh random existing records from NPI
 */
export class UsGrowthDiscoveryService {
  constructor(
    private readonly npi: NpiService,
    private readonly physicians: PhysicianRepository,
    private readonly progress: DiscoveryProgressRepository
  ) {}

  async run(options: UsGrowthDiscoveryOptions = {}): Promise<UsGrowthDiscoveryResult> {
    const targetNew = options.targetNew ?? 200;

    const cursor = await this.progress.get();
    let stateIndex = cursor.state_index;
    const stateSkips = { ...cursor.state_skips };
    const startStateIndex = stateIndex;

    const newRecords: NormalizedPhysicianInput[] = [];
    let pagesScanned = 0;
    let lapHadNew = false;

    while (newRecords.length < targetNew && pagesScanned < MAX_API_PAGES_PER_RUN) {
      const state = US_STATE_CODES[stateIndex] as string;
      const skip = stateSkips[state] ?? 0;

      const search = await this.npi.searchCardiologists({
        state,
        limit: NPI_PAGE_SIZE,
        skip,
      });
      pagesScanned++;

      const pageNpis = search.results
        .map((r) => r.npi)
        .filter((npi): npi is string => Boolean(npi));
      const existing = await this.physicians.getExistingNpiSet(pageNpis);

      for (const record of search.results) {
        if (!record.npi || existing.has(record.npi)) continue;
        newRecords.push(record);
        lapHadNew = true;
        if (newRecords.length >= targetNew) break;
      }

      const pageExhausted =
        search.results.length < NPI_PAGE_SIZE ||
        skip + NPI_PAGE_SIZE >= search.result_count;

      if (pageExhausted) {
        stateSkips[state] = 0;
        stateIndex = (stateIndex + 1) % US_STATE_CODES.length;
      } else {
        stateSkips[state] = skip + NPI_PAGE_SIZE;
      }

      if (stateIndex === startStateIndex && pagesScanned > 0 && !lapHadNew) {
        break;
      }

      if (stateIndex === startStateIndex && lapHadNew) {
        lapHadNew = false;
      }
    }

    const dedupedNew = deduplicateRecords(newRecords).slice(0, targetNew);
    const createdPhysicianIds: string[] = [];
    let created = 0;
    let failed = 0;

    for (const record of dedupedNew) {
      try {
        const result = await this.physicians.upsertByNpiOrName(record);
        if (result.action === "created") {
          created++;
          createdPhysicianIds.push(result.id);
        }
      } catch (error) {
        failed++;
        logger.warn("US growth insert failed", {
          npi: record.npi,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    let updated = 0;
    let mode: UsGrowthDiscoveryResult["mode"] = "new_leads";

    if (created === 0) {
      mode = "refresh_fallback";
      const refreshPool = await this.physicians.listRandomWithNpi(REFRESH_PER_RUN);

      for (const physician of refreshPool) {
        if (!physician.npi) continue;
        try {
          const fresh = await this.npi.lookupByNumber(physician.npi);
          if (!fresh) continue;
          await this.physicians.upsertByNpiOrName(fresh);
          updated++;
        } catch (error) {
          failed++;
          logger.warn("US growth refresh failed", {
            npi: physician.npi,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    }

    await this.progress.save({
      state_index: stateIndex,
      state_skips: stateSkips,
      last_mode: mode,
    });

    logger.info("US growth discovery completed", {
      mode,
      created,
      updated,
      pagesScanned,
      stateIndex,
      failed,
    });

    return {
      source: "npi_registry_us_growth",
      found: dedupedNew.length,
      created,
      updated,
      createdPhysicianIds,
      mode,
      pages_scanned: pagesScanned,
      refresh_target: REFRESH_PER_RUN,
    };
  }
}
