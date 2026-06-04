import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import type { PhysicianStatus } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = (await request.json()) as { status: PhysicianStatus };
    if (!status) return jsonError("status is required");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const container = getContainer(supabase);
    const physician = await container.physicians.updateStatus(id, status);

    await container.activities.create({
      physician_id: id,
      user_id: user?.id,
      activity_type: "status_change",
      title: `Status changed to ${status}`,
      completed_at: new Date().toISOString(),
    });

    return jsonOk(physician);
  } catch (error) {
    return handleApiError(error, "PATCH /api/physicians/[id]/status");
  }
}
