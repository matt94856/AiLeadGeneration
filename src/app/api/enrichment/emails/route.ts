import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { runEmailWebhookBatch } from "@/lib/webhook-batch";
import type { WebhookBatchData } from "@/lib/batch-options";

export const maxDuration = 60;

/**
 * AI email enrichment for leads missing email addresses.
 * Processes a small chunk per request; auto-continues in background until done.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`enrichment:${ip}`, 5, 60_000);
    if (!limit.success) return jsonError("Rate limit exceeded", 429);

    if (!process.env.OPENAI_API_KEY) {
      return jsonError("OPENAI_API_KEY is required for email enrichment", 503);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const body = (await request.json().catch(() => ({}))) as WebhookBatchData;

    const container = getContainer(supabase);
    const result = await runEmailWebhookBatch(container, {
      ...body,
      all_pending: body.all_pending ?? !body.today_only,
    });

    if (result.processed > 0) {
      await container.activities
        .create({
          physician_id: result.results[0]?.physician_id ?? user.id,
          user_id: user.id,
          activity_type: "research",
          title: "AI email enrichment batch completed",
          description: `Found ${result.found} emails, ${result.remaining} still missing`,
          metadata: { summary: { found: result.found, processed: result.processed } },
          completed_at: new Date().toISOString(),
        })
        .catch(() => undefined);
    }

    return jsonOk({
      ...result,
      serper_configured: Boolean(process.env.SERPER_API_KEY),
      hint: process.env.SERPER_API_KEY
        ? result.continuation_queued
          ? "More email lookups continue via Vercel Cron every 3 minutes."
          : undefined
        : "Add SERPER_API_KEY (free at serper.dev) for much better email discovery from public web results.",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/enrichment/emails");
  }
}
