import { logger } from "@/lib/logger";
import type { DiscoveryResult } from "@/services/discovery/discovery.service";
import type { ServiceContainer } from "@/services/container";

export function collectCreatedPhysicianIds(
  results: DiscoveryResult | DiscoveryResult[]
): string[] {
  return (Array.isArray(results) ? results : [results]).flatMap((r) => r.createdPhysicianIds);
}

export async function runAutoScoringAfterDiscovery(
  container: ServiceContainer,
  results: DiscoveryResult | DiscoveryResult[],
  options?: { limit?: number }
) {
  const createdIds = collectCreatedPhysicianIds(results);
  const today = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

  try {
    return await container.research.researchBatch({
      limit: options?.limit ?? 50,
      physicianIds: createdIds.length ? createdIds : undefined,
      discoveredSince: createdIds.length ? undefined : today,
    });
  } catch (error) {
    logger.error("Auto scoring after discovery failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
