import { after } from "next/server";
import { logger } from "@/lib/logger";
import { MAX_CONTINUATION_DEPTH } from "@/lib/batch-config";
import type { WebhookBatchData } from "@/lib/batch-options";

export function resolveAppBaseUrl(): string | null {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return null;
}

export function getContinuationDepth(data: WebhookBatchData | undefined): number {
  const depth = data?._continuation_depth;
  return typeof depth === "number" ? depth : Number(depth ?? 0) || 0;
}

export function scheduleWebhookContinuation(
  event: string,
  data: WebhookBatchData
): boolean {
  const depth = getContinuationDepth(data);
  if (depth >= MAX_CONTINUATION_DEPTH) {
    logger.warn("Webhook continuation depth limit reached", { event, depth });
    return false;
  }

  const baseUrl = resolveAppBaseUrl();
  const secret = process.env.WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    logger.error("Cannot schedule webhook continuation — set APP_URL or deploy on Vercel", {
      event,
    });
    return false;
  }

  const payload = {
    event,
    data: { ...data, _continuation_depth: depth + 1 },
  };

  after(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/webhooks/n8n`, {
        method: "POST",
        headers: {
          "x-webhook-secret": secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.error("Webhook continuation request failed", {
          event,
          status: res.status,
          body: text.slice(0, 200),
        });
      } else {
        logger.info("Webhook continuation scheduled", { event, depth: depth + 1 });
      }
    } catch (error) {
      logger.error("Webhook continuation fetch error", {
        event,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  });

  return true;
}
