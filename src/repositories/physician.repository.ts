import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Physician,
  PhysicianFilters,
  PhysicianStatus,
  PublicationRecord,
  ConferenceRecord,
  SpeakingRecord,
} from "@/types";
import { physicianNeedsScoring, physicianNeedsEmail } from "@/lib/scoring-status";

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
    if (filters.hasEmail === true) {
      query = query.not("email", "is", null).neq("email", "");
    } else if (filters.hasEmail === false) {
      query = query.or("email.is.null,email.eq.");
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
    }
  ): Promise<{ action: "created" | "updated"; id: string }> {
    const first_name = record.first_name?.trim();
    const last_name = record.last_name?.trim();
    if (!first_name || !last_name) {
      throw new Error("first_name and last_name are required");
    }

    const demographicFields = {
      first_name,
      last_name,
      specialty: record.specialty ?? "Cardiology",
      subspecialty: record.subspecialty ?? null,
      city: record.city ?? null,
      state: record.state ?? null,
      organization: record.organization ?? null,
      years_in_practice: record.years_in_practice ?? null,
      phone: record.phone ?? null,
      npi: record.npi ?? null,
      website: record.website ?? null,
      linkedin_url: record.linkedin_url ?? null,
      source: record.source,
    };

    if (demographicFields.npi) {
      const { data: existing } = await this.supabase
        .from("physicians")
        .select("id")
        .eq("npi", demographicFields.npi)
        .maybeSingle();

      if (existing) {
        const { error } = await this.supabase
          .from("physicians")
          .update(demographicFields)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return { action: "updated", id: existing.id };
      }
    }

    const { data: nameMatch } = await this.supabase
      .from("physicians")
      .select("id")
      .ilike("first_name", first_name)
      .ilike("last_name", last_name)
      .eq("state", demographicFields.state ?? "")
      .maybeSingle();

    if (nameMatch) {
      const { error } = await this.supabase
        .from("physicians")
        .update(demographicFields)
        .eq("id", nameMatch.id);
      if (error) throw new Error(error.message);
      return { action: "updated", id: nameMatch.id };
    }

    const { data, error } = await this.supabase
      .from("physicians")
      .insert({
        ...demographicFields,
        lead_score: 0,
        status: "new_lead",
        research_metadata: { scoring_status: "pending" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { action: "created", id: data.id as string };
  }

  async listNeedsScoring(limit = 25, discoveredSince?: string): Promise<Physician[]> {
    let query = this.supabase
      .from("physicians")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit * 5, 500));

    if (discoveredSince) {
      query = query.gte("created_at", discoveredSince);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Physician[]).filter(physicianNeedsScoring).slice(0, limit);
  }

  async countNeedsScoring(discoveredSince?: string): Promise<number> {
    return (await this.listNeedsScoring(500, discoveredSince)).length;
  }

  private applyEmailEnrichmentQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    options?: { overwrite?: boolean; discoveredSince?: string }
  ) {
    let next = query.or("email.is.null,email.eq.");

    if (!options?.overwrite) {
      next = next.filter("research_metadata->email_enrichment->>enriched_at", "is", null);
    }

    if (options?.discoveredSince) {
      next = next.gte("created_at", options.discoveredSince);
    }

    return next;
  }

  async listMissingEmail(
    limit = 25,
    discoveredSince?: string,
    options?: { overwrite?: boolean }
  ): Promise<Physician[]> {
    let query = this.supabase.from("physicians").select("*");

    query = this.applyEmailEnrichmentQuery(query, { ...options, discoveredSince });
    query = query.order("lead_score", { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Physician[]).filter((physician) =>
      physicianNeedsEmail(physician, options)
    );
  }

  async countMissingEmail(
    discoveredSince?: string,
    options?: { overwrite?: boolean }
  ): Promise<number> {
    let query = this.supabase.from("physicians").select("id", { count: "exact", head: true });

    query = this.applyEmailEnrichmentQuery(query, { ...options, discoveredSince });

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async getExistingNpiSet(npis: string[]): Promise<Set<string>> {
    if (!npis.length) return new Set();
    const { data, error } = await this.supabase
      .from("physicians")
      .select("npi")
      .in("npi", npis);
    if (error) throw new Error(error.message);
    return new Set(
      (data ?? [])
        .map((row) => row.npi as string | null)
        .filter((npi): npi is string => Boolean(npi))
    );
  }

  async listRandomWithNpi(limit: number): Promise<Physician[]> {
    const { data, error } = await this.supabase
      .from("physicians")
      .select("*")
      .not("npi", "is", null)
      .order("updated_at", { ascending: true })
      .limit(Math.min(limit * 3, 600));

    if (error) throw new Error(error.message);
    const pool = (data ?? []) as Physician[];
    return shuffleArray(pool).slice(0, limit);
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
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}
