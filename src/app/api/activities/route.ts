import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import type { ActivityType } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const physicianId = searchParams.get("physician_id");
    if (!physicianId) return jsonError("physician_id is required");

    const supabase = await createClient();
    const container = getContainer(supabase);
    const activities = await container.activities.listByPhysician(physicianId);
    return jsonOk(activities);
  } catch (error) {
    return handleApiError(error, "GET /api/activities");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      physician_id: string;
      activity_type: ActivityType;
      title: string;
      description?: string;
      scheduled_at?: string;
    };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const container = getContainer(supabase);
    const activity = await container.activities.create({
      ...body,
      user_id: user?.id,
      completed_at: new Date().toISOString(),
    });
    return jsonOk(activity);
  } catch (error) {
    return handleApiError(error, "POST /api/activities");
  }
}
