import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, ActivityType } from "@/types";

export class ActivityRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByPhysician(physicianId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from("activities")
      .select("*")
      .eq("physician_id", physicianId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Activity[];
  }

  async create(input: {
    physician_id: string;
    user_id?: string;
    activity_type: ActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    scheduled_at?: string;
    completed_at?: string;
  }): Promise<Activity> {
    const { data, error } = await this.supabase
      .from("activities")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Activity;
  }
}
