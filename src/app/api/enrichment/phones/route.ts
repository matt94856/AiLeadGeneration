import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { runPhoneWebhookBatch } from "@/lib/webhook-batch";
import type { WebhookBatchData } from "@/lib/batch-options";

export const maxDuration = 60;

/** Free-first phone enrichment for leads — scrapes public profile pages. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`phone-enrichment:${ip}`, 5, 60_000);
    if (!limit.success) return jsonError("Rate limit exceeded", 429);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const body = (await request.json().catch(() => ({}))) as WebhookBatchData;
    const container = getContainer(supabase);
    const result = await runPhoneWebhookBatch(container, {
      ...body,
      all_pending: body.all_pending ?? !body.today_only,
    });

    if (result.processed > 0) {
      await container.activities
        .create({
          physician_id: result.results[0]?.physician_id ?? user.id,
          user_id: user.id,
          activity_type: "research",
          title: "Phone enrichment batch completed",
          description: `Found ${result.found} phones (${result.upgraded} profile-listed), ${result.remaining} remaining`,
          metadata: {
            summary: {
              found: result.found,
              upgraded: result.upgraded,
              sheets_synced: result.sheets_synced,
            },
          },
          completed_at: new Date().toISOString(),
        })
        .catch(() => undefined);
    }

    return jsonOk({
      ...result,
      sheets_configured: container.googleSheets.isConfigured(),
      hint: container.googleSheets.isConfigured()
        ? "New phones are appended to your Google Sheet after each batch."
        : "Set GOOGLE_SHEETS_* env vars to auto-sync phones to Google Sheets.",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/enrichment/phones");
  }
}
