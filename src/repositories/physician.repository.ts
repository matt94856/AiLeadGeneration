import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Physician,
  PhysicianFilters,
  PhysicianStatus,
  PublicationRecord,
  ConferenceRecord,
  SpeakingRecord,
} from "@/types";

export class PhysicianRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<Physician | null> {
    const { data, error } = await this.supabase
      .from("physicians")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Physician;
  }

  async search(filters: PhysicianFilters): Promise<{ data: Physician[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.from("physicians").select("*", { count: "exact" });

    if (filters.specialty) query = query.ilike("specialty", `%${filters.specialty}%`);
    if (filters.subspecialty) query = query.ilike("subspecialty", `%${filters.subspecialty}%`);
    if (filters.state) query = query.eq("state", filters.state);
    if (filters.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters.organization) query = query.ilike("organization", `%${filters.organization}%`);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.minYears != null) query = query.gte("years_in_practice", filters.minYears);
    if (filters.maxYears != null) query = query.lte("years_in_practice", filters.maxYears);
    if (filters.minScore != null) query = query.gte("lead_score", filters.minScore);
    if (filters.maxScore != null) query = query.lte("lead_score", filters.maxScore);
    if (filters.keyword) {
      const kw = `%${filters.keyword}%`;
      query = query.or(
        `first_name.ilike.${kw},last_name.ilike.${kw},organization.ilike.${kw},physician_summary.ilike.${kw}`
      );
    }
    if (filters.discoveredSince) {
      query = query.gte("created_at", filters.discoveredSince);
    }

    query = query.order("lead_score", { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: (data ?? []) as Physician[], total: count ?? 0 };
  }

  async listByStatus(status: PhysicianStatus): Promise<Physician[]> {
    const { data, error } = await this.supabase
      .from("physicians")
      .select("*")
      .eq("status", status)
      .order("lead_score", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Physician[];
  }

  async update(id: string, patch: Partial<Physician>): Promise<Physician> {
    const { data, error } = await this.supabase
      .from("physicians")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Physician;
  }

  async updateStatus(id: string, status: PhysicianStatus): Promise<Physician> {
    return this.update(id, { status });
  }

  async upsertByNpiOrName(
    record: Partial<Physician> & {
      first_name: string;
      last_name: string;
      source: string;
      lead_score?: number;
      scoring_factors?: Record<string, boolean>;
    }
  ): Promise<"created" | "updated"> {
    const first_name = record.first_name?.trim();
    const last_name = record.last_name?.trim();
    if (!first_name || !last_name) {
      throw new Error("first_name and last_name are required");
    }

    const payload = { ...record, first_name, last_name };

    if (payload.npi) {
      const { data: existing } = await this.supabase
        .from("physicians")
        .select("id")
        .eq("npi", payload.npi)
        .maybeSingle();

      if (existing) {
        await this.supabase.from("physicians").update(payload).eq("id", existing.id);
        return "updated";
      }
    }

    const { data: nameMatch } = await this.supabase
      .from("physicians")
      .select("id")
      .ilike("first_name", first_name)
      .ilike("last_name", last_name)
      .eq("state", payload.state ?? "")
      .maybeSingle();

    if (nameMatch) {
      await this.supabase.from("physicians").update(payload).eq("id", nameMatch.id);
      return "updated";
    }

    const { error } = await this.supabase.from("physicians").insert({
      ...payload,
      specialty: payload.specialty ?? "Cardiology",
      lead_score: payload.lead_score ?? 0,
      status: "new_lead",
    });
    if (error) throw new Error(error.message);
    return "created";
  }

  async saveResearch(
    physicianId: string,
    research: {
      current_employer?: string | null;
      practice_size?: string | null;
      hospital_affiliations?: string[];
      publications?: PublicationRecord[];
      speaking_appearances?: SpeakingRecord[];
      conference_participation?: ConferenceRecord[];
      raw_sources?: Record<string, unknown>;
    }
  ) {
    const { error } = await this.supabase.from("physician_research").upsert(
      {
        physician_id: physicianId,
        ...research,
        researched_at: new Date().toISOString(),
      },
      { onConflict: "physician_id" }
    );
    if (error) throw new Error(error.message);
  }

  async getResearch(physicianId: string) {
    const { data, error } = await this.supabase
      .from("physician_research")
      .select("*")
      .eq("physician_id", physicianId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async listMissingEmail(limit = 25, discoveredSince?: string): Promise<Physician[]> {
    let query = this.supabase
      .from("physicians")
      .select("*")
      .or("email.is.null,email.eq.")
      .order("lead_score", { ascending: false })
      .limit(limit);

    if (discoveredSince) {
      query = query.gte("created_at", discoveredSince);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Physician[];
  }
}
