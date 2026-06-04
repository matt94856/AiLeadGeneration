"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/physicians/activity-timeline";
import { OutreachPanel } from "@/components/physicians/outreach-panel";
import type { Physician, Activity, OutreachDraft } from "@/types";

export default function PhysicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [physician, setPhysician] = useState<Physician | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [detailRes, actRes, draftsRes] = await Promise.all([
      fetch(`/api/physicians/${id}`),
      fetch(`/api/activities?physician_id=${id}`),
      fetch(`/api/outreach/list?physician_id=${id}`),
    ]);
    const detail = await detailRes.json();
    const acts = await actRes.json();
    const draftsJson = await draftsRes.json();
    if (detail.success) setPhysician(detail.data.physician);
    if (acts.success) setActivities(acts.data);
    if (draftsJson.success) setDrafts(draftsJson.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runResearch() {
    await fetch(`/api/research/${id}`, { method: "POST" });
    await load();
  }

  async function generateFollowUp() {
    await fetch(`/api/follow-up/${id}`, { method: "POST" });
  }

  async function generateOutreach(channel: "email" | "linkedin" | "voicemail") {
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ physician_id: id, channel }),
    });
    await load();
  }

  async function approveDraft(draftId: string) {
    await fetch(`/api/outreach/${draftId}/approve`, { method: "POST" });
    await load();
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!physician) return <p className="text-destructive">Physician not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Dr. {physician.first_name} {physician.last_name}
          </h1>
          <p className="text-muted-foreground">
            {physician.subspecialty ?? physician.specialty} · {physician.city}, {physician.state}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Score {physician.lead_score}</Badge>
          <Badge variant="outline" className="capitalize">
            {physician.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runResearch}>Run AI Research</Button>
        <Button variant="outline" onClick={generateFollowUp}>
          Generate Follow-up
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">NPI:</span> {physician.npi ?? "—"}</p>
            <p><span className="text-muted-foreground">Organization:</span> {physician.organization ?? "—"}</p>
            <p><span className="text-muted-foreground">Years in practice:</span> {physician.years_in_practice ?? "—"}</p>
            <p><span className="text-muted-foreground">Source:</span> {physician.source ?? "—"}</p>
            {physician.physician_summary && (
              <p className="mt-4 text-muted-foreground leading-relaxed">{physician.physician_summary}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>

      <OutreachPanel
        physicianId={id}
        drafts={drafts}
        onGenerate={generateOutreach}
        onApprove={approveDraft}
      />
    </div>
  );
}
