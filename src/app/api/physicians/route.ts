import { createClient } from "@/lib/supabase/server";
import { getContainer } from "@/services/container";
import { jsonOk, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { clampPageSize } from "@/lib/pagination";
import type { PhysicianFilters } from "@/types";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`physicians-list:${ip}`, 120, 60_000);
    if (!limit.success) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const filters: PhysicianFilters = {
      specialty: searchParams.get("specialty") ?? undefined,
      subspecialty: searchParams.get("subspecialty") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      organization: searchParams.get("organization") ?? undefined,
      status: (searchParams.get("status") as PhysicianFilters["status"]) ?? undefined,
      keyword: searchParams.get("keyword") ?? undefined,
      discoveredSince: searchParams.get("discovered_since") ?? undefined,
      minYears: searchParams.get("minYears") ? Number(searchParams.get("minYears")) : undefined,
      maxYears: searchParams.get("maxYears") ? Number(searchParams.get("maxYears")) : undefined,
      minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
      maxScore: searchParams.get("maxScore") ? Number(searchParams.get("maxScore")) : undefined,
      hasEmail:
        searchParams.get("hasEmail") === "true"
          ? true
          : searchParams.get("hasEmail") === "false"
            ? false
            : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: clampPageSize(
        searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
      ),
    };

    const container = getContainer(supabase);
    const result = await container.physicians.search(filters);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error, "GET /api/physicians");
  }
}
