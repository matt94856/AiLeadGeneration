"use client";

import { useEffect, useState } from "react";
import { ScoringWeightsEditor } from "@/components/admin/scoring-weights-editor";
import type { ScoringWeight } from "@/types";

export default function ScoringAdminPage() {
  const [weights, setWeights] = useState<ScoringWeight[]>([]);

  useEffect(() => {
    fetch("/api/scoring/weights")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setWeights(json.data);
      });
  }, []);

  async function onSave(
    factorKey: string,
    updates: { weight?: number; is_active?: boolean }
  ) {
    const res = await fetch("/api/scoring/weights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factor_key: factorKey, ...updates }),
    });
    const json = await res.json();
    if (json.success) {
      setWeights((prev) =>
        prev.map((w) => (w.factor_key === factorKey ? json.data : w))
      );
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Lead Scoring Weights</h1>
        <p className="text-muted-foreground text-sm">
          Admin-only. Adjust factor weights; scores normalize to 0–100.
        </p>
      </div>
      <ScoringWeightsEditor weights={weights} onSave={onSave} />
    </div>
  );
}
