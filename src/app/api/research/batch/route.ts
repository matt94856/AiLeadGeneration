import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`research-batch:${ip}`, 10, 60_000);
    if (!limit.success) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      today_only?: boolean;
      physician_ids?: string[];
    };

    const supabase = await createClient();
    const container = getContainer(supabase);
    const result = await container.research.researchBatch({
      limit: body.limit ?? 25,
      discoveredSince: body.today_only
        ? new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"
        : undefined,
      physicianIds: body.physician_ids,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "POST /api/research/batch");
  }
}
