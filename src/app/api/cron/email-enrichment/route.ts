import { createServiceClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { verifyCronRequest } from "@/lib/cron-auth";
import { getContainer } from "@/services/container";
import { runEmailWebhookBatch } from "@/lib/webhook-batch";

export const maxDuration = 60;

/** Vercel Cron — continues email enrichment without self-HTTP (avoids 508 loop detection). */
export async function GET(request: Request) {
  try {
    if (!verifyCronRequest(request)) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = await createServiceClient();
    const container = getContainer(supabase);
    const remaining = await container.physicians.countMissingEmail();

    if (remaining === 0) {
      return jsonOk({ skipped: true, reason: "no_leads_need_email_enrichment" });
    }

    const result = await runEmailWebhookBatch(container, {
      all_pending: true,
      limit: 4,
    });

    return jsonOk({ remaining_before: remaining, ...result });
  } catch (error) {
    return handleApiError(error, "GET /api/cron/email-enrichment");
  }
}
