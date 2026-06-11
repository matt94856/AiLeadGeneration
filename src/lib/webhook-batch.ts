import type { ServiceContainer } from "@/services/container";
import { BATCH_TIME_BUDGET_MS, MAX_CONTINUATION_DEPTH } from "@/lib/batch-config";
import { getContinuationDepth } from "@/lib/webhook-continuation";
import {
  resolveChunkLimit,
  resolveEmailChunkLimit,
  resolvePhoneChunkLimit,
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

export function buildPhoneBatchPayload(data: WebhookBatchData): WebhookBatchData {
  return {
    limit: resolvePhoneChunkLimit(data),
    today_only: data.today_only,
    all_pending: data.all_pending ?? !data.today_only,
    overwrite: data.overwrite,
    sync_sheets: data.sync_sheets ?? true,
    _continuation_depth: data._continuation_depth ?? 0,
  };
}

export async function runResearchWebhookBatchSingle(
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

  return { ...result, continuation_queued: false };
}

export async function runEmailWebhookBatchSingle(
  container: ServiceContainer,
  data: WebhookBatchData
) {
  const payload = buildEmailBatchPayload(data);
  const result = await container.emailEnrichment.enrichBatch({
    limit: resolveEmailChunkLimit(payload),
    discoveredSince: resolveDiscoveredSince(payload),
    overwrite: Boolean(payload.overwrite),
  });

  return { ...result, continuation_queued: false };
}

export async function runPhoneWebhookBatchSingle(
  container: ServiceContainer,
  data: WebhookBatchData
) {
  const payload = buildPhoneBatchPayload(data);
  const result = await container.phoneEnrichment.enrichBatch({
    limit: resolvePhoneChunkLimit(payload),
    discoveredSince: resolveDiscoveredSince(payload),
    overwrite: Boolean(payload.overwrite),
    syncSheets: payload.sync_sheets !== false,
  });

  return { ...result, continuation_queued: false };
}

interface BatchLoopOptions {
  maxMs?: number;
}

export async function runResearchWebhookBatch(
  container: ServiceContainer,
  data: WebhookBatchData,
  options?: BatchLoopOptions
) {
  const maxMs = options?.maxMs ?? BATCH_TIME_BUDGET_MS;
  const start = Date.now();
  let currentData = buildResearchBatchPayload(data);
  let lastResult = await runResearchWebhookBatchSingle(container, currentData);
  let chunks = 1;

  while (lastResult.has_more && Date.now() - start < maxMs) {
    const depth = getContinuationDepth(currentData) + 1;
    if (depth >= MAX_CONTINUATION_DEPTH) break;

    currentData = { ...currentData, _continuation_depth: depth };
    lastResult = await runResearchWebhookBatchSingle(container, currentData);
    chunks++;
  }

  return {
    ...lastResult,
    chunks_run: chunks,
    completed: !lastResult.has_more,
    cron_will_continue: lastResult.has_more,
    continuation_queued: lastResult.has_more,
  };
}

export async function runPhoneWebhookBatch(
  container: ServiceContainer,
  data: WebhookBatchData,
  options?: BatchLoopOptions
) {
  const maxMs = options?.maxMs ?? BATCH_TIME_BUDGET_MS;
  const start = Date.now();
  let currentData = buildPhoneBatchPayload(data);
  let lastResult = await runPhoneWebhookBatchSingle(container, currentData);
  let chunks = 1;

  while (lastResult.has_more && Date.now() - start < maxMs) {
    const depth = getContinuationDepth(currentData) + 1;
    if (depth >= MAX_CONTINUATION_DEPTH) break;

    currentData = { ...currentData, _continuation_depth: depth };
    lastResult = await runPhoneWebhookBatchSingle(container, currentData);
    chunks++;
  }

  return {
    ...lastResult,
    chunks_run: chunks,
    completed: !lastResult.has_more,
    cron_will_continue: lastResult.has_more,
    continuation_queued: lastResult.has_more,
  };
}

export async function runEmailWebhookBatch(
  container: ServiceContainer,
  data: WebhookBatchData,
  options?: BatchLoopOptions
) {
  const maxMs = options?.maxMs ?? BATCH_TIME_BUDGET_MS;
  const start = Date.now();
  let currentData = buildEmailBatchPayload(data);
  let lastResult = await runEmailWebhookBatchSingle(container, currentData);
  let chunks = 1;

  while (lastResult.has_more && Date.now() - start < maxMs) {
    const depth = getContinuationDepth(currentData) + 1;
    if (depth >= MAX_CONTINUATION_DEPTH) break;

    currentData = { ...currentData, _continuation_depth: depth };
    lastResult = await runEmailWebhookBatchSingle(container, currentData);
    chunks++;
  }

  return {
    ...lastResult,
    chunks_run: chunks,
    completed: !lastResult.has_more,
    cron_will_continue: lastResult.has_more,
    continuation_queued: lastResult.has_more,
  };
}
