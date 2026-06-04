import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardMetrics, Physician, PhysicianStatus } from "@/types";
import { PIPELINE_STAGES } from "@/types";

export class DashboardRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const [
      newPhysicians,
      scoredLeads,
      topOpportunities,
      outreachSent,
      responses,
      allPhysicians,
      recentActivities,
    ] = await Promise.all([
      this.supabase
        .from("physicians")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      this.supabase
        .from("physicians")
        .select("id", { count: "exact", head: true })
        .gt("lead_score", 0),
      this.supabase
        .from("physicians")
        .select("*")
        .gte("lead_score", 60)
        .not("status", "eq", "archived")
        .order("lead_score", { ascending: false })
        .limit(5),
      this.supabase
        .from("outreach_drafts")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent"),
      this.supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("activity_type", "email")
        .ilike("title", "%response%"),
      this.supabase.from("physicians").select("lead_score, status, created_at"),
      this.supabase
        .from("activities")
        .select("created_at")
        .eq("activity_type", "discovery")
        .gte("created_at", since),
    ]);

    const physicians = (allPhysicians.data ?? []) as {
      lead_score: number;
      status: PhysicianStatus;
      created_at: string;
    }[];

    const pipelineByStage = PIPELINE_STAGES.map((stage) => ({
      stage: stage.label,
      count: physicians.filter((p) => p.status === stage.id).length,
    }));

    const scoreDistribution = [
      { range: "0-20", count: physicians.filter((p) => p.lead_score <= 20).length },
      { range: "21-40", count: physicians.filter((p) => p.lead_score > 20 && p.lead_score <= 40).length },
      { range: "41-60", count: physicians.filter((p) => p.lead_score > 40 && p.lead_score <= 60).length },
      { range: "61-80", count: physicians.filter((p) => p.lead_score > 60 && p.lead_score <= 80).length },
      { range: "81-100", count: physicians.filter((p) => p.lead_score > 80).length },
    ];

    const discoveryByDay = new Map<string, number>();
    for (const p of physicians) {
      const day = p.created_at.slice(0, 10);
      discoveryByDay.set(day, (discoveryByDay.get(day) ?? 0) + 1);
    }
    const discoveryTrend = Array.from(discoveryByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    return {
      newPhysiciansDiscovered: newPhysicians.count ?? 0,
      leadsScored: scoredLeads.count ?? 0,
      topOpportunities: (topOpportunities.data ?? []) as Physician[],
      outreachSent: outreachSent.count ?? 0,
      responsesReceived: responses.count ?? 0,
      pipelineByStage,
      scoreDistribution,
      discoveryTrend,
    };
  }

  async getFollowUpRecommendations(limit = 10) {
    const { data, error } = await this.supabase
      .from("follow_up_recommendations")
      .select("*, physicians(first_name, last_name, lead_score)")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
