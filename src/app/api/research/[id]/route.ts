import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`research:${ip}`, 20, 60_000);
    if (!limit.success) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const container = getContainer(supabase);
    const physician = await container.research.researchPhysician(id);

    await container.activities.create({
      physician_id: id,
      user_id: user?.id,
      activity_type: "research",
      title: "AI research completed",
      description: physician.physician_summary ?? undefined,
      completed_at: new Date().toISOString(),
    });

    return jsonOk(physician);
  } catch (error) {
    return handleApiError(error, "POST /api/research/[id]");
  }
}
