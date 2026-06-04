"use client";

import { useEffect, useState } from "react";
import { PhysicianTable } from "@/components/physicians/physician-table";
import type { Physician } from "@/types";

export default function PhysiciansPage() {
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/physicians?limit=50")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPhysicians(json.data.data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Physicians</h1>
        <p className="text-muted-foreground text-sm">Your cardiologist lead database</p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <PhysicianTable physicians={physicians} />
      )}
    </div>
  );
}
