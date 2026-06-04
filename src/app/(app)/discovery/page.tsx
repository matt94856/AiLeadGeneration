"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DiscoveryPage() {
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState<string>("all");
  const [state, setState] = useState("FL");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/discovery")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSources(json.data.sources);
      });
  }, []);

  async function runDiscovery() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: source === "all" ? undefined : source,
        state,
        runAll: source === "all",
      }),
    });
    const json = await res.json();
    if (json.success) {
      setResult(
        `Found ${json.data.totals.found}, created ${json.data.totals.created}, updated ${json.data.totals.updated}`
      );
    } else {
      setResult(json.error?.message ?? "Discovery failed");
    }
    setLoading(false);
  }

  const sourceLabels: Record<string, string> = {
    npi_registry: "NPI Registry (CMS)",
    cms_physician_compare: "CMS Physician Compare",
    state_medical_board: "State Medical Board API",
    hospital_directory: "Hospital Physician Directory",
    group_practice_website: "Group Practice Index",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Discovery</h1>
        <p className="text-muted-foreground text-sm">
          Collect cardiologist leads from public data sources only
        </p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Run collector</CardTitle>
          <CardDescription>
            Data is normalized, deduplicated, and scored automatically. No verified personal emails from public APIs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {sourceLabels[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="state">State (optional)</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
          </div>
          <Button onClick={runDiscovery} disabled={loading}>
            {loading ? "Running…" : "Start discovery"}
          </Button>
          {result && <p className="text-sm text-muted-foreground">{result}</p>}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((s) => (
          <Card key={s}>
            <CardHeader>
              <CardTitle className="text-sm">{sourceLabels[s] ?? s}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {s === "npi_registry" && "Official NPPES NPI Registry API — free, no key."}
                {s === "cms_physician_compare" && "CMS public physician datasets via data.cms.gov."}
                {s === "state_medical_board" && "Optional: set STATE_BOARD_API_URL for your state feed."}
                {s === "hospital_directory" && "Optional: HOSPITAL_DIRECTORY_FEED_URL JSON feed."}
                {s === "group_practice_website" && "Optional: GROUP_PRACTICE_INDEX_URL JSON index (not HTML scraping)."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
