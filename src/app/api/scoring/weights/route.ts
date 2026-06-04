import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { calculateLeadScore } from "@/lib/scoring";

export async function GET() {
  try {
    const supabase = await createClient();
    const container = getContainer(supabase);
    const weights = await container.scoring.getAllWeights();
    return jsonOk(weights);
  } catch (error) {
    return handleApiError(error, "GET /api/scoring/weights");
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .single();

    if (profile?.role !== "admin") {
      return jsonError("Admin access required", 403);
    }

    const body = (await request.json()) as {
      factor_key: string;
      weight?: number;
      label?: string;
      is_active?: boolean;
    };

    const container = getContainer(supabase);
    const updated = await container.scoring.updateWeight(body.factor_key, {
      weight: body.weight,
      label: body.label,
      is_active: body.is_active,
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error, "PATCH /api/scoring/weights");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { factors: Record<string, boolean> };
    const supabase = await createClient();
    const container = getContainer(supabase);
    const weights = await container.scoring.getWeights();
    const score = calculateLeadScore(body.factors, weights);
    return jsonOk({ score });
  } catch (error) {
    return handleApiError(error, "POST /api/scoring/weights");
  }
}
