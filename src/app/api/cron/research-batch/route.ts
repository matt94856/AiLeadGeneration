import { createServiceClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { verifyCronRequest } from "@/lib/cron-auth";
import { getContainer } from "@/services/container";
import { runResearchWebhookBatch } from "@/lib/webhook-batch";

export const maxDuration = 60;

/** Vercel Cron — continues AI scoring without self-HTTP (avoids 508 loop detection). */
export async function GET(request: Request) {
  try {
    if (!verifyCronRequest(request)) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = await createServiceClient();
    const container = getContainer(supabase);
    const remaining = await container.physicians.countNeedsScoring();

    if (remaining === 0) {
      return jsonOk({ skipped: true, reason: "no_leads_need_scoring" });
    }

    const result = await runResearchWebhookBatch(container, {
      all_pending: true,
      limit: 12,
    });

    return jsonOk({ remaining_before: remaining, ...result });
  } catch (error) {
    return handleApiError(error, "GET /api/cron/research-batch");
  }
}
