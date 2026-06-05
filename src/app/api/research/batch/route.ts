import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { runResearchWebhookBatch } from "@/lib/webhook-batch";
import type { WebhookBatchData } from "@/lib/batch-options";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`research-batch:${ip}`, 10, 60_000);
    if (!limit.success) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as WebhookBatchData;

    const supabase = await createClient();
    const container = getContainer(supabase);
    const result = await runResearchWebhookBatch(container, {
      ...body,
      all_pending: body.all_pending ?? !body.today_only,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "POST /api/research/batch");
  }
}
