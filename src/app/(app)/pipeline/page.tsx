"use client";

import { useEffect, useState, useCallback } from "react";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { PIPELINE_STAGES, type Physician, type PhysicianStatus } from "@/types";

export default function PipelinePage() {
  const emptyStages = (): Record<PhysicianStatus, Physician[]> => ({
    new_lead: [],
    researching: [],
    qualified: [],
    contacted: [],
    interested: [],
    credentialing: [],
    presented: [],
    placed: [],
    archived: [],
  });
  const [byStage, setByStage] = useState<Record<PhysicianStatus, Physician[]>>(emptyStages);

  const load = useCallback(async () => {
    const res = await fetch("/api/physicians?limit=200");
    const json = await res.json();
    if (!json.success) return;
    const physicians = json.data.data as Physician[];
    const grouped = Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s.id, physicians.filter((p) => p.status === s.id)])
    ) as Record<PhysicianStatus, Physician[]>;
    setByStage(grouped);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onStatusChange(physicianId: string, status: PhysicianStatus) {
    await fetch(`/api/physicians/${physicianId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CRM Pipeline</h1>
        <p className="text-muted-foreground text-sm">
          Drag cards between stages to update lead status
        </p>
      </div>
      <KanbanBoard physiciansByStage={byStage} onStatusChange={onStatusChange} />
    </div>
  );
}
