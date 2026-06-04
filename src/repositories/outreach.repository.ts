import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutreachChannel, OutreachDraft } from "@/types";

export class OutreachRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByPhysician(physicianId: string): Promise<OutreachDraft[]> {
    const { data, error } = await this.supabase
      .from("outreach_drafts")
      .select("*")
      .eq("physician_id", physicianId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OutreachDraft[];
  }

  async create(input: {
    physician_id: string;
    channel: OutreachChannel;
    subject?: string;
    body: string;
    created_by?: string;
    personalization_context?: Record<string, unknown>;
  }): Promise<OutreachDraft> {
    const { data, error } = await this.supabase
      .from("outreach_drafts")
      .insert({ ...input, status: "draft" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as OutreachDraft;
  }

  async approve(id: string, approvedBy: string): Promise<OutreachDraft> {
    const { data, error } = await this.supabase
      .from("outreach_drafts")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as OutreachDraft;
  }

  async markSent(id: string): Promise<OutreachDraft> {
    const { data, error } = await this.supabase
      .from("outreach_drafts")
      .update({ status: "sent" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as OutreachDraft;
  }
}
