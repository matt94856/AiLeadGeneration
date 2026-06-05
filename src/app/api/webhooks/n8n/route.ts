import { createServiceClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getContainer, resetContainer } from "@/services/container";
import { runAutoScoringAfterDiscovery, collectCreatedPhysicianIds } from "@/services/discovery/auto-scoring";
import { after } from "next/server";

/**
 * n8n-compatible webhook endpoint.
 * Authenticate with WEBHOOK_SECRET header: x-webhook-secret
 *
 * Supported events:
 * - discovery.run { source?, state?, city?, limit? }
 * - research.batch { limit?, today_only?, physician_ids? }
 * - research.run { physician_id }
 * - physician.status { physician_id, status }
 * - enrichment.emails { limit?, today_only? }
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return jsonError("Unauthorized", 401);
    }

    const payload = await request.json() as {
      event: string;
      data?: Record<string, unknown>;
    };

    const supabase = await createServiceClient();
    await supabase.from("webhook_events").insert({
      event_type: payload.event,
      payload,
    });

    resetContainer();
    const container = getContainer(supabase);
    let result: unknown = { acknowledged: true };

    switch (payload.event) {
      case "discovery.run": {
        const data = payload.data ?? {};
        const params: Record<string, string> = {};
        if (data.state) params.state = String(data.state);
        if (data.city) params.city = String(data.city);
        if (data.limit) params.limit = String(data.limit);

        let discoveryResult;
        if (data.source) {
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
        const data = payload.data ?? {};
        result = await container.research.researchBatch({
          limit: data.limit ? Number(data.limit) : 25,
          discoveredSince: data.today_only
            ? new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"
            : undefined,
          physicianIds: Array.isArray(data.physician_ids)
            ? data.physician_ids.map(String)
            : undefined,
        });
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
        const data = payload.data ?? {};
        result = await container.emailEnrichment.enrichBatch({
          limit: data.limit ? Number(data.limit) : 25,
          discoveredSince: data.today_only ? new Date().toISOString().slice(0, 10) + "T00:00:00.000Z" : undefined,
        });
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
