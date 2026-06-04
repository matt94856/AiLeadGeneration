import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

/** Approve draft for manual send — does NOT auto-send */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const container = getContainer(supabase);
    const draft = await container.outreach.approve(id, user.id);
    return jsonOk(draft);
  } catch (error) {
    return handleApiError(error, "POST /api/outreach/[id]/approve");
  }
}
