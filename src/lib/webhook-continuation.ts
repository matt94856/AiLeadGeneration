import { logger } from "@/lib/logger";
import { MAX_CONTINUATION_DEPTH } from "@/lib/batch-config";
import type { WebhookBatchData } from "@/lib/batch-options";

export function getContinuationDepth(data: WebhookBatchData | undefined): number {
  const depth = data?._continuation_depth;
  return typeof depth === "number" ? depth : Number(depth ?? 0) || 0;
}

/**
 * @deprecated Vercel returns 508 INFINITE_LOOP_DETECTED when a function HTTP-fetches itself.
 * Use in-process batch loops (webhook-batch.ts) + Vercel Cron instead.
 */
export function scheduleWebhookContinuation(
  event: string,
  data: WebhookBatchData
): boolean {
  const depth = getContinuationDepth(data);
  if (depth >= MAX_CONTINUATION_DEPTH) {
    logger.warn("Webhook continuation depth limit reached", { event, depth });
    return false;
  }

  logger.info("HTTP self-continuation skipped — Vercel cron continues batch work", {
    event,
    depth,
  });
  return false;
}
