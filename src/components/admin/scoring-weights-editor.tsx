"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ScoringWeight } from "@/types";

interface Props {
  weights: ScoringWeight[];
  onSave: (factorKey: string, updates: { weight?: number; is_active?: boolean }) => Promise<void>;
}

export function ScoringWeightsEditor({ weights, onSave }: Props) {
  const [local, setLocal] = useState(weights);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(factorKey: string) {
    const item = local.find((w) => w.factor_key === factorKey);
    if (!item) return;
    setSaving(factorKey);
    await onSave(factorKey, { weight: item.weight, is_active: item.is_active });
    setSaving(null);
  }

  const totalActive = local.filter((w) => w.is_active).reduce((s, w) => s + w.weight, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Active weight sum: {totalActive} (scores normalize to 0–100)
      </p>
      {local.map((weight) => (
        <Card key={weight.factor_key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{weight.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  checked={weight.is_active}
                  onCheckedChange={(checked) =>
                    setLocal((prev) =>
                      prev.map((w) =>
                        w.factor_key === weight.factor_key ? { ...w, is_active: checked } : w
                      )
                    )
                  }
                />
                <Label className="text-xs text-muted-foreground">Active</Label>
              </div>
            </div>
            {weight.description && (
              <p className="text-xs text-muted-foreground">{weight.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Slider
                value={[weight.weight]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) =>
                  setLocal((prev) =>
                    prev.map((w) =>
                      w.factor_key === weight.factor_key && v !== undefined
                        ? { ...w, weight: v }
                        : w
                    )
                  )
                }
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-sm">+{weight.weight}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => save(weight.factor_key)}
              disabled={saving === weight.factor_key}
            >
              {saving === weight.factor_key ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
