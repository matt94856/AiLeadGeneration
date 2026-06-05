import { createClient } from "@/lib/supabase/server";
import { getContainer, resetContainer } from "@/services/container";
import { jsonOk, jsonError, handleApiError } from "@/lib/api-response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { runAutoScoringAfterDiscovery } from "@/services/discovery/auto-scoring";
import { after } from "next/server";
import type { DiscoveryResult } from "@/services/discovery/discovery.service";

export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const container = getContainer(supabase);
  return jsonOk({ sources: container.discovery.listSources() });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`discovery:${ip}`, 10, 60_000);
    if (!limit.success) return jsonError("Rate limit exceeded", 429);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError("Unauthorized", 401);

    const body = (await request.json()) as {
      source?: string;
      state?: string;
      city?: string;
      limit?: number;
      runAll?: boolean;
      us_wide?: boolean;
    };

    const container = getContainer(supabase);
    const params: Record<string, string> = {};
    if (body.state) params.state = body.state;
    if (body.city) params.city = body.city;
    if (body.limit) params.limit = String(body.limit);

    const { data: run } = await supabase
      .from("discovery_runs")
      .insert({
        source: body.us_wide ? "npi_registry_us_growth" : body.source ?? "all",
        status: "running",
        started_by: user.id,
      })
      .select()
      .single();

    let results: DiscoveryResult | DiscoveryResult[];
    const usWide = body.us_wide || (!body.state && body.source === "npi_registry");

    if (usWide) {
      results = await container.usGrowthDiscovery.run({
        targetNew: body.limit ?? 200,
      });
    } else if (body.runAll || !body.source) {
      results = await container.discovery.runAllSources(params);
    } else {
      results = [await container.discovery.runDiscovery(body.source, params)];
    }

    const list = Array.isArray(results) ? results : [results];
    const totals = list.reduce(
      (acc, r) => ({
        found: acc.found + r.found,
        created: acc.created + r.created,
        updated: acc.updated + r.updated,
      }),
      { found: 0, created: 0, updated: 0 }
    );

    if (run) {
      await supabase
        .from("discovery_runs")
        .update({
          status: "completed",
          records_found: totals.found,
          records_created: totals.created,
          records_updated: totals.updated,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    logger.info("Discovery activity", { userId: user.id, totals, runId: run?.id });

    after(async () => {
      try {
        resetContainer();
        const bgSupabase = await createClient();
        const bgContainer = getContainer(bgSupabase);
        await runAutoScoringAfterDiscovery(bgContainer, results);
      } catch (error) {
        logger.error("Background scoring after UI discovery failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    });

    return jsonOk({ results, totals, scoring: { status: "queued" } });
  } catch (error) {
    return handleApiError(error, "POST /api/discovery");
  }
}
