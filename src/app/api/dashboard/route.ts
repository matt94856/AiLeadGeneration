import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const supabase = await createClient();
    const container = getContainer(supabase);
    const [metrics, recommendations] = await Promise.all([
      container.dashboard.getMetrics(),
      container.dashboard.getFollowUpRecommendations(),
    ]);
    return jsonOk({ metrics, recommendations });
  } catch (error) {
    return handleApiError(error, "GET /api/dashboard");
  }
}
