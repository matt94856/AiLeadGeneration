"use client";

import { useEffect, useState } from "react";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { DashboardCharts } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { DashboardMetrics, Physician } from "@/types";
import { PhysicianTable } from "@/components/physicians/physician-table";
import { Button } from "@/components/ui/button";
import { startOfDay } from "date-fns";
import { isScoringPending } from "@/lib/scoring-status";

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
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);

  function reloadLeads() {
    const since = startOfDay(new Date()).toISOString();
    return fetch(`/api/physicians?discovered_since=${encodeURIComponent(since)}&limit=50`)
      .then((r) => r.json())
      .then((leadsJson) => {
        if (leadsJson.success) setTodaysLeads(leadsJson.data.data);
      });
  }

  useEffect(() => {
    if (!todaysLeads.some(isScoringPending)) return;
    const interval = setInterval(reloadLeads, 5000);
    return () => clearInterval(interval);
  }, [todaysLeads]);

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

  async function scoreLeadsWithAi() {
    setScoring(true);
    setScoreMessage(null);
    const res = await fetch("/api/research/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ today_only: true, limit: 50 }),
    });
    const json = await res.json();
    setScoring(false);
    if (json.success) {
      setScoreMessage(
        `Scored ${json.data.completed} leads (${json.data.failed} failed). Highest scores appear at the top of Search.`
      );
      await reloadLeads();
    } else {
      setScoreMessage(json.error?.message ?? "AI scoring failed");
    }
  }

  async function findEmailsWithAi() {
    setEnriching(true);
    setEnrichMessage(null);
    const res = await fetch("/api/enrichment/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ today_only: true, limit: 25 }),
    });
    const json = await res.json();
    setEnriching(false);
    if (json.success) {
      setEnrichMessage(
        `Found ${json.data.found} emails (${json.data.not_found} not found). ${json.data.hint ?? "Review AI-suggested emails before sending."}`
      );
      await reloadLeads();
    } else {
      setEnrichMessage(json.error?.message ?? "Email enrichment failed");
    }
  }

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
              From n8n / discovery — use AI to find public emails, then generate &amp; send outreach
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="sm" variant="secondary" onClick={scoreLeadsWithAi} disabled={scoring}>
              {scoring ? "Scoring…" : "AI score leads"}
            </Button>
            <Button size="sm" variant="secondary" onClick={findEmailsWithAi} disabled={enriching}>
              {enriching ? "Searching…" : "AI find emails"}
            </Button>
            <Link href="/discovery" className="text-sm text-primary hover:underline self-center">
              Run discovery
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scoreMessage && (
            <p className="text-sm text-muted-foreground rounded-md border p-2 bg-muted/40">
              {scoreMessage}
            </p>
          )}
          {enrichMessage && (
            <p className="text-sm text-muted-foreground rounded-md border p-2 bg-muted/40">
              {enrichMessage}
            </p>
          )}
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
