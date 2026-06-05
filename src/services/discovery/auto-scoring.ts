import { logger } from "@/lib/logger";
import { DEFAULT_BATCH_CHUNK } from "@/lib/batch-config";
import { runResearchWebhookBatch } from "@/lib/webhook-batch";
import type { DiscoveryResult } from "@/services/discovery/discovery.service";
import type { ServiceContainer } from "@/services/container";

export function collectCreatedPhysicianIds(
  results: DiscoveryResult | DiscoveryResult[]
): string[] {
  return (Array.isArray(results) ? results : [results]).flatMap((r) => r.createdPhysicianIds);
}

/** Kick off AI scoring in-process; Vercel Cron continues if more leads remain. */
export async function runAutoScoringAfterDiscovery(
  container: ServiceContainer,
  results: DiscoveryResult | DiscoveryResult[]
) {
  const createdIds = collectCreatedPhysicianIds(results);

  const payload = {
    limit: DEFAULT_BATCH_CHUNK,
    all_pending: createdIds.length === 0,
    today_only: createdIds.length > 0,
    physician_ids: createdIds.length ? createdIds : undefined,
    _continuation_depth: 0,
  };

  try {
    return await runResearchWebhookBatch(container, payload);
  } catch (error) {
    logger.error("Auto scoring after discovery failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
