import { createServiceClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getContainer, resetContainer } from "@/services/container";
import { runAutoScoringAfterDiscovery, collectCreatedPhysicianIds } from "@/services/discovery/auto-scoring";
import {
  buildEmailBatchPayload,
  buildResearchBatchPayload,
  runResearchWebhookBatch,
  runEmailWebhookBatch,
} from "@/lib/webhook-batch";
import type { WebhookBatchData } from "@/lib/batch-options";
import { resolveChunkLimit, resolveEmailChunkLimit } from "@/lib/batch-options";
import { after } from "next/server";

export const maxDuration = 60;

/**
 * n8n-compatible webhook endpoint.
 * Authenticate with WEBHOOK_SECRET header: x-webhook-secret
 *
 * Batch events process up to 12 physicians per call, then auto-chain until done.
 *
 * Supported events:
 * - discovery.run { source?, state?, city?, limit? }
 * - research.batch { limit?, today_only?, all_pending? }
 * - research.run { physician_id }
 * - physician.status { physician_id, status }
 * - enrichment.emails { limit?, today_only?, all_pending? }
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return jsonError("Unauthorized", 401);
    }

    const payload = await request.json() as {
      event: string;
      data?: WebhookBatchData;
    };

    const supabase = await createServiceClient();
    await supabase.from("webhook_events").insert({
      event_type: payload.event,
      payload,
    });

    resetContainer();
    const container = getContainer(supabase);
    let result: unknown = { acknowledged: true };
    const data = payload.data ?? {};

    switch (payload.event) {
      case "discovery.run": {
        const params: Record<string, string> = {};
        if (data.state) params.state = String(data.state);
        if (data.city) params.city = String(data.city);
        if (data.limit) params.limit = String(data.limit);

        const usWide =
          data.us_wide === true ||
          (!data.state && String(data.source ?? "npi_registry") === "npi_registry");

        let discoveryResult;
        if (usWide) {
          discoveryResult = await container.usGrowthDiscovery.run({
            targetNew: data.limit ? Number(data.limit) : 200,
          });
        } else if (data.source) {
          discoveryResult = await container.discovery.runDiscovery(String(data.source), params);
        } else {
          discoveryResult = await container.discovery.runAllSources(params);
        }

        const createdIds = collectCreatedPhysicianIds(discoveryResult);

        after(async () => {
          try {
            resetContainer();
            const bgSupabase = await createServiceClient();
            const bgContainer = getContainer(bgSupabase);
            await runAutoScoringAfterDiscovery(bgContainer, discoveryResult);
          } catch (error) {
            logger.error("Background research batch failed", {
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        });

        result = {
          discovery: discoveryResult,
          scoring: { status: "queued", created_count: createdIds.length },
        };
        break;
      }
      case "research.batch": {
        const payload = buildResearchBatchPayload(data);
        after(async () => {
          try {
            resetContainer();
            const bgSupabase = await createServiceClient();
            const bgContainer = getContainer(bgSupabase);
            await runResearchWebhookBatch(bgContainer, data);
          } catch (error) {
            logger.error("Background research batch failed", {
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        });
        result = {
          status: "started",
          chunk_limit: resolveChunkLimit(payload),
          continuation: "auto",
          message: "Scoring runs in background; Vercel Cron continues until complete.",
        };
        break;
      }
      case "research.run": {
        const physicianId = String(payload.data?.physician_id ?? "");
        result = await container.research.researchPhysician(physicianId);
        break;
      }
      case "physician.status": {
        result = await container.physicians.updateStatus(
          String(payload.data?.physician_id),
          payload.data?.status as never
        );
        break;
      }
      case "enrichment.emails": {
        const payload = buildEmailBatchPayload(data);
        after(async () => {
          try {
            resetContainer();
            const bgSupabase = await createServiceClient();
            const bgContainer = getContainer(bgSupabase);
            const batchResult = await runEmailWebhookBatch(bgContainer, data);
            logger.info("Background email enrichment chunk finished", {
              processed: batchResult.processed,
              remaining: batchResult.remaining,
              continuation_queued: batchResult.continuation_queued,
            });
          } catch (error) {
            logger.error("Background email enrichment failed", {
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        });
        result = {
          status: "started",
          chunk_limit: resolveEmailChunkLimit(payload),
          continuation: "auto",
          message: "Email enrichment runs in background; Vercel Cron continues until complete.",
        };
        break;
      }
      default:
        logger.warn("Unknown webhook event", { event: payload.event });
    }

    return jsonOk({ event: payload.event, result });
  } catch (error) {
    return handleApiError(error, "POST /api/webhooks/n8n");
  }
}
