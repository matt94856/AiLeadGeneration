import { createServiceClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getContainer } from "@/services/container";

/**
 * n8n-compatible webhook endpoint.
 * Authenticate with WEBHOOK_SECRET header: x-webhook-secret
 *
 * Supported events:
 * - discovery.run { source?, state?, city?, limit? }
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

    const container = getContainer(supabase);
    let result: unknown = { acknowledged: true };

    switch (payload.event) {
      case "discovery.run": {
        const data = payload.data ?? {};
        const params: Record<string, string> = {};
        if (data.state) params.state = String(data.state);
        if (data.city) params.city = String(data.city);
        if (data.limit) params.limit = String(data.limit);

        if (data.source) {
          result = await container.discovery.runDiscovery(String(data.source), params);
        } else {
          result = await container.discovery.runAllSources(params);
        }
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
