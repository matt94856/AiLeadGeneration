"use client";

import { useEffect, useState } from "react";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { DashboardCharts } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { DashboardMetrics, Physician } from "@/types";
import { PhysicianTable } from "@/components/physicians/physician-table";
import { startOfDay } from "date-fns";

interface DashboardData {
  metrics: DashboardMetrics;
  recommendations: Array<{
    id: string;
    recommendation: string;
    priority: string;
    reasoning: string | null;
    physicians?: { first_name: string; last_name: string; lead_score: number };
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [todaysLeads, setTodaysLeads] = useState<Physician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = startOfDay(new Date()).toISOString();
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch(`/api/physicians?discovered_since=${encodeURIComponent(since)}&limit=50`).then(
        (r) => r.json()
      ),
    ]).then(([dashboardJson, leadsJson]) => {
      if (dashboardJson.success) setData(dashboardJson.data);
      if (leadsJson.success) setTodaysLeads(leadsJson.data.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading dashboard…</p>;
  if (!data) return <p className="text-destructive">Failed to load dashboard.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiter Dashboard</h1>
        <p className="text-muted-foreground text-sm">Pipeline health and top opportunities</p>
      </div>
      <MetricsCards metrics={data.metrics} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>New leads today</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              From n8n / discovery runs — open a lead, generate email, then Approve &amp; Send
            </p>
          </div>
          <Link href="/discovery" className="text-sm text-primary hover:underline">
            Run discovery
          </Link>
        </CardHeader>
        <CardContent>
          <PhysicianTable physicians={todaysLeads} />
        </CardContent>
      </Card>
      <DashboardCharts metrics={data.metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.metrics.topOpportunities.map((p) => (
              <Link
                key={p.id}
                href={`/physicians/${p.id}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
              >
                <span className="font-medium">
                  Dr. {p.first_name} {p.last_name}
                </span>
                <Badge variant="success">{p.lead_score}</Badge>
              </Link>
            ))}
            {!data.metrics.topOpportunities.length && (
              <p className="text-sm text-muted-foreground">No high-score leads yet. Run discovery.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={r.priority === "high" ? "default" : "secondary"}>
                    {r.priority}
                  </Badge>
                  <span className="font-medium text-sm">{r.recommendation}</span>
                </div>
                {r.physicians && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dr. {r.physicians.first_name} {r.physicians.last_name} · Score {r.physicians.lead_score}
                  </p>
                )}
                {r.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">{r.reasoning}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
