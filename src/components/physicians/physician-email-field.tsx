"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  physicianId: string;
  initialEmail: string | null;
  aiSuggested?: boolean;
  onSaved: () => void;
}

export function PhysicianEmailField({
  physicianId,
  initialEmail,
  aiSuggested = false,
  onSaved,
}: Props) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(initialEmail ?? "");
  }, [initialEmail]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/physicians/${physicianId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setMessage("Email saved.");
      onSaved();
    } else {
      setMessage(json.error?.message ?? "Failed to save");
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-2 bg-card">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="physician-email">Physician email (required to Approve &amp; Send)</Label>
        {aiSuggested && initialEmail && (
          <Badge variant="outline" className="text-[10px]">
            AI found
          </Badge>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id="physician-email"
          type="email"
          placeholder="cardiologist@hospital.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save email"}
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
