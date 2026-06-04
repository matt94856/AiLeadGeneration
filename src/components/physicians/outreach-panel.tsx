"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OutreachDraft } from "@/types";

interface Props {
  physicianEmail: string | null;
  drafts: OutreachDraft[];
  onGenerate: (channel: "email" | "linkedin" | "voicemail") => Promise<void>;
  onApproveAndSend: (draftId: string) => Promise<{ error?: string }>;
}

export function OutreachPanel({
  physicianEmail,
  drafts,
  onGenerate,
  onApproveAndSend,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleGenerate(channel: "email" | "linkedin" | "voicemail") {
    setLoading(channel);
    setSendError(null);
    await onGenerate(channel);
    setLoading(null);
  }

  async function handleSend(draftId: string) {
    setLoading(`send-${draftId}`);
    setSendError(null);
    const result = await onApproveAndSend(draftId);
    if (result.error) setSendError(result.error);
    setLoading(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outreach Drafts</CardTitle>
        <p className="text-xs text-muted-foreground">
          Generate with AI, review, then click Approve &amp; Send to email from your Gmail.
          {!physicianEmail && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              Add a physician email on the profile before sending.
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {sendError && (
          <p className="text-sm text-destructive mb-3 rounded-md border border-destructive/30 p-2">
            {sendError}
          </p>
        )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs capitalize text-muted-foreground">
                        {draft.status}
                      </span>
                      {channel === "email" && draft.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(draft.id)}
                          disabled={!physicianEmail || loading === `send-${draft.id}`}
                        >
                          {loading === `send-${draft.id}` ? "Sending…" : "Approve & Send"}
                        </Button>
                      )}
                      {channel === "email" && draft.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSend(draft.id)}
                          disabled={!physicianEmail || loading === `send-${draft.id}`}
                        >
                          {loading === `send-${draft.id}` ? "Sending…" : "Send now"}
                        </Button>
                      )}
                      {channel === "email" && draft.status === "sent" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Sent via Gmail</span>
                      )}
                      {channel !== "email" && draft.status === "draft" && (
                        <span className="text-xs text-muted-foreground">Copy and send manually</span>
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
