import { deduplicateRecords } from "@/lib/deduplication";
import { filterValidPhysicianRecords } from "@/lib/physician-validation";
import { logger } from "@/lib/logger";
import type { DataSourceAdapter } from "@/services/types";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { NormalizedPhysicianInput } from "@/types";

export interface DiscoveryResult {
  source: string;
  found: number;
  created: number;
  updated: number;
  createdPhysicianIds: string[];
}

export class DiscoveryService {
  constructor(
    private readonly adapters: Map<string, DataSourceAdapter>,
    private readonly physicianRepo: PhysicianRepository
  ) {}

  listSources(): string[] {
    return Array.from(this.adapters.keys());
  }

  async runDiscovery(
    sourceId: string,
    params: Record<string, string>
  ): Promise<DiscoveryResult> {
    const adapter = this.adapters.get(sourceId);
    if (!adapter) {
      throw new Error(`Unknown discovery source: ${sourceId}`);
    }

    logger.info("Discovery run started", { sourceId, params });
    const raw = await adapter.collect(params);
    const valid = filterValidPhysicianRecords(raw);
    const deduped = deduplicateRecords(valid);
    const skipped = raw.length - valid.length;

    if (skipped > 0) {
      logger.info("Skipped invalid discovery records", { sourceId, skipped });
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const createdPhysicianIds: string[] = [];

    for (const record of deduped) {
      try {
        const result = await this.physicianRepo.upsertByNpiOrName(record);
        if (result.action === "created") {
          created++;
          createdPhysicianIds.push(result.id);
        } else {
          updated++;
        }
      } catch (error) {
        failed++;
        logger.warn("Physician upsert skipped", {
          sourceId,
          npi: record.npi,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    logger.info("Discovery run completed", {
      sourceId,
      found: deduped.length,
      created,
      updated,
      skipped,
      failed,
    });
    return { source: sourceId, found: deduped.length, created, updated, createdPhysicianIds };
  }

  async runAllSources(params: Record<string, string>): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];
    for (const sourceId of this.adapters.keys()) {
      try {
        results.push(await this.runDiscovery(sourceId, params));
      } catch (error) {
        logger.error("Discovery source failed", {
          sourceId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    return results;
  }
}
