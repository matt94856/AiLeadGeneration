import { logger } from "@/lib/logger";
import { scheduleWebhookContinuation } from "@/lib/webhook-continuation";
import { DEFAULT_BATCH_CHUNK } from "@/lib/batch-config";
import type { DiscoveryResult } from "@/services/discovery/discovery.service";
import type { ServiceContainer } from "@/services/container";

export function collectCreatedPhysicianIds(
  results: DiscoveryResult | DiscoveryResult[]
): string[] {
  return (Array.isArray(results) ? results : [results]).flatMap((r) => r.createdPhysicianIds);
}

/** Kick off chained AI scoring (small chunks, auto-continues in background). */
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
    if (createdIds.length > 0) {
      const first = await container.research.researchBatch({
        limit: DEFAULT_BATCH_CHUNK,
        physicianIds: createdIds,
      });
      if (first.has_more) {
        scheduleWebhookContinuation("research.batch", payload);
      }
      return first;
    }

    scheduleWebhookContinuation("research.batch", payload);
    return { status: "queued", message: "Scoring chain started" };
  } catch (error) {
    logger.error("Auto scoring after discovery failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
