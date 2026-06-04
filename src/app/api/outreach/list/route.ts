import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const physicianId = new URL(request.url).searchParams.get("physician_id");
    if (!physicianId) return jsonError("physician_id is required");

    const supabase = await createClient();
    const container = getContainer(supabase);
    const drafts = await container.outreach.listByPhysician(physicianId);
    return jsonOk(drafts);
  } catch (error) {
    return handleApiError(error, "GET /api/outreach/list");
  }
}
