import type { ServiceContainer } from "@/services/container";
import { scheduleWebhookContinuation } from "@/lib/webhook-continuation";
import {
  resolveChunkLimit,
  resolveEmailChunkLimit,
  resolveDiscoveredSince,
  type WebhookBatchData,
} from "@/lib/batch-options";

export function buildResearchBatchPayload(data: WebhookBatchData): WebhookBatchData {
  return {
    limit: resolveChunkLimit(data),
    today_only: data.today_only,
    all_pending: data.all_pending ?? !data.today_only,
    physician_ids: data.physician_ids,
    _continuation_depth: data._continuation_depth ?? 0,
  };
}

export function buildEmailBatchPayload(data: WebhookBatchData): WebhookBatchData {
  return {
    limit: resolveEmailChunkLimit(data),
    today_only: data.today_only,
    all_pending: data.all_pending ?? !data.today_only,
    overwrite: data.overwrite,
    _continuation_depth: data._continuation_depth ?? 0,
  };
}

export async function runResearchWebhookBatch(
  container: ServiceContainer,
  data: WebhookBatchData
) {
  const payload = buildResearchBatchPayload(data);
  const result = await container.research.researchBatch({
    limit: resolveChunkLimit(payload),
    discoveredSince: resolveDiscoveredSince(payload),
    physicianIds: Array.isArray(payload.physician_ids)
      ? payload.physician_ids.map(String)
      : undefined,
  });

  const continuation_queued =
    result.has_more && scheduleWebhookContinuation("research.batch", payload);

  return { ...result, continuation_queued };
}

export async function runEmailWebhookBatch(
  container: ServiceContainer,
  data: WebhookBatchData
) {
  const payload = buildEmailBatchPayload(data);
  const result = await container.emailEnrichment.enrichBatch({
    limit: resolveEmailChunkLimit(payload),
    discoveredSince: resolveDiscoveredSince(payload),
    overwrite: Boolean(payload.overwrite),
  });

  const continuation_queued =
    result.has_more && scheduleWebhookContinuation("enrichment.emails", payload);

  return { ...result, continuation_queued };
}
