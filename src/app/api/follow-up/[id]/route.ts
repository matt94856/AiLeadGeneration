import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const container = getContainer(supabase);

    const physician = await container.physicians.findById(id);
    if (!physician) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    const activities = await container.activities.listByPhysician(id);
    const context = JSON.stringify({
      physician: {
        name: `${physician.first_name} ${physician.last_name}`,
        lead_score: physician.lead_score,
        status: physician.status,
        summary: physician.physician_summary,
      },
      recent_activities: activities.slice(0, 10),
    });

    const suggestion = await container.openai.generateFollowUpRecommendation(context);

    const { data, error } = await supabase.from("follow_up_recommendations").insert({
      physician_id: id,
      recommendation: suggestion.recommendation,
      priority: suggestion.priority,
      reasoning: suggestion.reasoning,
      suggested_action_date: suggestion.suggested_action_date ?? null,
    }).select().single();

    if (error) throw new Error(error.message);
    return jsonOk(data);
  } catch (error) {
    return handleApiError(error, "POST /api/follow-up/[id]");
  }
}
