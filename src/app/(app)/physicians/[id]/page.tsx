"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/physicians/activity-timeline";
import { OutreachPanel } from "@/components/physicians/outreach-panel";
import { PhysicianEmailField } from "@/components/physicians/physician-email-field";
import { PhysicianContactInfo } from "@/components/physicians/physician-contact-info";
import { LeadScoreBadge } from "@/components/physicians/lead-score-badge";
import { hasAiFoundEmail, isScoringPending } from "@/lib/scoring-status";
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

  useEffect(() => {
    if (!physician || !isScoringPending(physician)) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [physician, load]);

  async function runResearch() {
    await fetch(`/api/research/${id}`, { method: "POST" });
    await load();
  }

  async function generateFollowUp() {
    await fetch(`/api/follow-up/${id}`, { method: "POST" });
  }

  async function findEmailWithAi() {
    const res = await fetch(`/api/enrichment/emails/${id}`, { method: "POST" });
    const json = await res.json();
    await load();
    if (!json.success) {
      alert(json.error?.message ?? "Could not find email");
    }
  }

  async function findPhoneWithAi() {
    const res = await fetch(`/api/enrichment/phones/${id}`, { method: "POST" });
    const json = await res.json();
    await load();
    if (!json.success) {
      alert(json.error?.message ?? "Could not find phone");
    }
  }

  async function generateOutreach(channel: "email" | "linkedin" | "voicemail") {
    await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ physician_id: id, channel }),
    });
    await load();
  }

  async function approveAndSend(draftId: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/outreach/${draftId}/send`, { method: "POST" });
    const json = await res.json();
    await load();
    if (!json.success) {
      return { error: json.error?.message ?? "Failed to send email" };
    }
    return {};
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
          <LeadScoreBadge physician={physician} />
          <Badge variant="outline" className="capitalize">
            {physician.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runResearch}>Run AI Research</Button>
        <Button variant="outline" onClick={findEmailWithAi}>
          AI find email
        </Button>
        <Button variant="outline" onClick={findPhoneWithAi}>
          Find phone
        </Button>
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
            <PhysicianContactInfo physician={physician} />
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

      <PhysicianEmailField
        physicianId={id}
        initialEmail={physician.email}
        aiSuggested={hasAiFoundEmail(physician)}
        onSaved={load}
      />

      <OutreachPanel
        physicianEmail={physician.email}
        drafts={drafts}
        onGenerate={generateOutreach}
        onApproveAndSend={approveAndSend}
      />
    </div>
  );
}
