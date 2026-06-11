import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const container = getContainer(supabase);
    const physician = await container.physicians.findById(id);
    if (!physician) return jsonError("Physician not found", 404);

    const result = await container.phoneEnrichment.enrichPhysician(physician, {
      overwrite: true,
    });

    if (result.phone && container.googleSheets.isConfigured()) {
      await container.googleSheets.syncPhysicians([
        { ...physician, phone: result.phone, updated_at: new Date().toISOString() },
      ]);
      await container.physicians.markPhoneSheetSynced(
        physician.id,
        result.phone,
        new Date().toISOString()
      );
    }

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "POST /api/enrichment/phones/[id]");
  }
}
