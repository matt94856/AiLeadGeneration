import { createServiceClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";

export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = request.headers.get("x-webhook-secret");
  return Boolean(secret && secret === process.env.WEBHOOK_SECRET);
}

/** Export all physicians with phone numbers (CSV or JSON). n8n / Google Sheets fallback. */
export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const unsyncedOnly = searchParams.get("unsynced_only") === "true";

    const supabase = await createServiceClient();
    const container = getContainer(supabase);

    const physicians = unsyncedOnly
      ? await container.physicians.listUnsyncedPhoneSheetRows(2000)
      : await container.physicians.listWithPhone(5000);

    const rows = physicians.map((p) => {
      const meta = p.research_metadata?.phone_enrichment as
        | { confidence?: string; source_url?: string | null }
        | undefined;

      return {
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: `Dr. ${p.first_name} ${p.last_name}`,
        phone: p.phone,
        npi: p.npi,
        city: p.city,
        state: p.state,
        organization: p.organization,
        confidence: meta?.confidence ?? "practice",
        source_url: meta?.source_url ?? "",
        updated_at: p.updated_at,
      };
    });

    if (format === "csv") {
      const headers = Object.keys(rows[0] ?? { phone: "" });
      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const value = String((row as Record<string, string | null>)[h] ?? "");
              return `"${value.replace(/"/g, '""')}"`;
            })
            .join(",")
        ),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="physician-phones.csv"',
        },
      });
    }

    return jsonOk({ count: rows.length, physicians: rows });
  } catch (error) {
    return handleApiError(error, "GET /api/export/physician-phones");
  }
}

/** Sync all unsynced physician phones to Google Sheets. */
export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) return jsonError("Unauthorized", 401);

    const supabase = await createServiceClient();
    const container = getContainer(supabase);

    if (!container.googleSheets.isConfigured()) {
      return jsonError(
        "Google Sheets not configured — set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY",
        503
      );
    }

    const synced = await container.googleSheets.syncUnsyncedPhysicians(container.physicians);
    return jsonOk({ synced, message: `Appended ${synced} rows to Google Sheets` });
  } catch (error) {
    return handleApiError(error, "POST /api/export/physician-phones");
  }
}
