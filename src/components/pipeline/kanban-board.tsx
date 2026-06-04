"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STAGES, type Physician, type PhysicianStatus } from "@/types";
import Link from "next/link";

interface KanbanBoardProps {
  physiciansByStage: Record<PhysicianStatus, Physician[]>;
  onStatusChange: (physicianId: string, status: PhysicianStatus) => Promise<void>;
}

function PhysicianCard({ physician }: { physician: Physician }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: physician.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-2 cursor-grab active:cursor-grabbing">
        <CardContent className="p-3">
          <Link href={`/physicians/${physician.id}`} className="font-medium hover:underline">
            Dr. {physician.first_name} {physician.last_name}
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            {physician.city}, {physician.state}
          </p>
          <Badge variant="secondary" className="mt-2">
            Score: {physician.lead_score}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function StageColumn({
  stageId,
  stageLabel,
  count,
  children,
}: {
  stageId: string;
  stageLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[260px] flex-shrink-0 rounded-xl border p-3 ${
        isOver ? "ring-2 ring-primary" : "bg-muted/30"
      }`}
    >
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm flex justify-between">
          {stageLabel}
          <span className="text-muted-foreground font-normal">{count}</span>
        </CardTitle>
      </CardHeader>
      {children}
    </div>
  );
}

export function KanbanBoard({ physiciansByStage, onStatusChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const activePhysician = activeId
    ? PIPELINE_STAGES.flatMap((s) => physiciansByStage[s.id]).find((p) => p?.id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const physicianId = String(active.id);
    const newStatus = String(over.id) as PhysicianStatus;
    const current = PIPELINE_STAGES.flatMap((s) => physiciansByStage[s.id]).find(
      (p) => p.id === physicianId
    );
    if (current && current.status !== newStatus) {
      await onStatusChange(physicianId, newStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <StageColumn
            key={stage.id}
            stageId={stage.id}
            stageLabel={stage.label}
            count={physiciansByStage[stage.id]?.length ?? 0}
          >
            <SortableContext
              items={(physiciansByStage[stage.id] ?? []).map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {(physiciansByStage[stage.id] ?? []).map((p) => (
                <PhysicianCard key={p.id} physician={p} />
              ))}
            </SortableContext>
          </StageColumn>
        ))}
      </div>
      <DragOverlay>
        {activePhysician ? (
          <Card className="w-64 shadow-lg">
            <CardContent className="p-3">
              Dr. {activePhysician.first_name} {activePhysician.last_name}
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
