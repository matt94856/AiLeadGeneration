import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const container = getContainer(supabase);
    const physician = await container.physicians.findById(id);
    if (!physician) return jsonError("Physician not found", 404);
    const research = await container.physicians.getResearch(id);
    return jsonOk({ physician, research });
  } catch (error) {
    return handleApiError(error, "GET /api/physicians/[id]");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = await createClient();
    const container = getContainer(supabase);
    const physician = await container.physicians.update(id, body);
    return jsonOk(physician);
  } catch (error) {
    return handleApiError(error, "PATCH /api/physicians/[id]");
  }
}
