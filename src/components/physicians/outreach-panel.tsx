"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OutreachDraft } from "@/types";

interface Props {
  physicianId: string;
  drafts: OutreachDraft[];
  onGenerate: (channel: "email" | "linkedin" | "voicemail") => Promise<void>;
  onApprove: (draftId: string) => Promise<void>;
}

export function OutreachPanel({ physicianId, drafts, onGenerate, onApprove }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleGenerate(channel: "email" | "linkedin" | "voicemail") {
    setLoading(channel);
    await onGenerate(channel);
    setLoading(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outreach Drafts</CardTitle>
        <p className="text-xs text-muted-foreground">
          AI-generated drafts require human review. Never auto-sent.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="voicemail">Voicemail</TabsTrigger>
          </TabsList>
          {(["email", "linkedin", "voicemail"] as const).map((channel) => (
            <TabsContent key={channel} value={channel} className="space-y-3">
              <Button
                size="sm"
                onClick={() => handleGenerate(channel)}
                disabled={loading === channel}
              >
                {loading === channel ? "Generating…" : `Generate ${channel} draft`}
              </Button>
              {drafts
                .filter((d) => d.channel === channel)
                .map((draft) => (
                  <div key={draft.id} className="rounded-lg border p-3 text-sm space-y-2">
                    {draft.subject && (
                      <p>
                        <span className="font-medium">Subject:</span> {draft.subject}
                      </p>
                    )}
                    <pre className="whitespace-pre-wrap font-sans text-muted-foreground">
                      {draft.body}
                    </pre>
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize text-muted-foreground">
                        {draft.status}
                      </span>
                      {draft.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(draft.id)}
                        >
                          Approve for manual send
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
