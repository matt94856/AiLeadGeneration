import type { SupabaseClient } from "@supabase/supabase-js";

export interface DiscoveryProgress {
  key: string;
  state_index: number;
  state_skips: Record<string, number>;
  last_mode: string | null;
  updated_at: string;
}

const DEFAULT_KEY = "npi_us";

export class DiscoveryProgressRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(key = DEFAULT_KEY): Promise<DiscoveryProgress> {
    const { data, error } = await this.supabase
      .from("discovery_progress")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return {
        key,
        state_index: 0,
        state_skips: {},
        last_mode: "new_leads",
        updated_at: new Date().toISOString(),
      };
    }

    return {
      key: data.key as string,
      state_index: data.state_index as number,
      state_skips: (data.state_skips as Record<string, number>) ?? {},
      last_mode: data.last_mode as string | null,
      updated_at: data.updated_at as string,
    };
  }

  async save(
    progress: Pick<DiscoveryProgress, "state_index" | "state_skips" | "last_mode">,
    key = DEFAULT_KEY
  ): Promise<void> {
    const { error } = await this.supabase.from("discovery_progress").upsert({
      key,
      state_index: progress.state_index,
      state_skips: progress.state_skips,
      last_mode: progress.last_mode,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}
