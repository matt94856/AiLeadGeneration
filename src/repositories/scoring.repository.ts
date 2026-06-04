import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringWeight } from "@/types";

const DEFAULT_WEIGHTS: ScoringWeight[] = [
  { id: "1", factor_key: "retirement_proximity", label: "Retirement Proximity", weight: 20, description: null, is_active: true },
  { id: "2", factor_key: "job_transition", label: "Job Transition", weight: 30, description: null, is_active: true },
  { id: "3", factor_key: "active_publications", label: "Active Publications", weight: 10, description: null, is_active: true },
  { id: "4", factor_key: "conference_participation", label: "Conference Participation", weight: 10, description: null, is_active: true },
  { id: "5", factor_key: "new_organization", label: "New Organization", weight: 20, description: null, is_active: true },
  { id: "6", factor_key: "private_practice", label: "Private Practice", weight: 10, description: null, is_active: true },
  { id: "7", factor_key: "prior_locums_indicators", label: "Prior Locums Indicators", weight: 40, description: null, is_active: true },
];

export class ScoringRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getWeights(): Promise<ScoringWeight[]> {
    const { data, error } = await this.supabase
      .from("scoring_weights")
      .select("*")
      .eq("is_active", true)
      .order("factor_key");
    if (error || !data?.length) return DEFAULT_WEIGHTS;
    return data as ScoringWeight[];
  }

  async getAllWeights(): Promise<ScoringWeight[]> {
    const { data, error } = await this.supabase
      .from("scoring_weights")
      .select("*")
      .order("factor_key");
    if (error) throw new Error(error.message);
    return (data ?? DEFAULT_WEIGHTS) as ScoringWeight[];
  }

  async updateWeight(
    factorKey: string,
    updates: { weight?: number; label?: string; is_active?: boolean }
  ): Promise<ScoringWeight> {
    const { data, error } = await this.supabase
      .from("scoring_weights")
      .update(updates)
      .eq("factor_key", factorKey)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ScoringWeight;
  }
}
