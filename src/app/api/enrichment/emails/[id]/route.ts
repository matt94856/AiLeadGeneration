import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonError("OPENAI_API_KEY is required", 503);
    }

    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const container = getContainer(supabase);
    const physician = await container.physicians.findById(id);
    if (!physician) return jsonError("Physician not found", 404);

    const result = await container.emailEnrichment.enrichPhysician(physician);
    return jsonOk({
      result,
      serper_configured: Boolean(process.env.SERPER_API_KEY),
    });
  } catch (error) {
    return handleApiError(error, "POST /api/enrichment/emails/[id]");
  }
}
