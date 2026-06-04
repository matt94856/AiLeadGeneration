import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { startOfDay } from "date-fns";

/**
 * AI email enrichment for leads missing email addresses.
 * Uses Serper (public web search) + OpenAI extraction — never guesses emails.
 *
 * Body: { limit?, today_only?, physician_ids? }
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

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      today_only?: boolean;
      physician_ids?: string[];
    };

    const container = getContainer(supabase);
    const discoveredSince = body.today_only
      ? startOfDay(new Date()).toISOString()
      : undefined;

    const result = await container.emailEnrichment.enrichBatch({
      limit: body.limit ?? 25,
      discoveredSince,
      physicianIds: body.physician_ids,
    });

    if (result.processed > 0) {
      await container.activities.create({
        physician_id: result.results[0]?.physician_id ?? user.id,
        user_id: user.id,
        activity_type: "research",
        title: "AI email enrichment batch completed",
        description: `Found ${result.found} emails, ${result.not_found} not found, ${result.errors} errors`,
        metadata: { summary: { found: result.found, processed: result.processed } },
        completed_at: new Date().toISOString(),
      }).catch(() => undefined);
    }

    return jsonOk({
      ...result,
      serper_configured: Boolean(process.env.SERPER_API_KEY),
      hint: process.env.SERPER_API_KEY
        ? undefined
        : "Add SERPER_API_KEY (free at serper.dev) for much better email discovery from public web results.",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/enrichment/emails");
  }
}
