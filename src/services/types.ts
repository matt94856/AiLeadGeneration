import type { NormalizedPhysicianInput } from "@/types";

export interface DataSourceAdapter {
  readonly sourceId: string;
  collect(params: Record<string, string>): Promise<NormalizedPhysicianInput[]>;
}

export interface NpiSearchParams {
  taxonomy_description?: string;
  state?: string;
  city?: string;
  first_name?: string;
  last_name?: string;
  limit?: number;
}

export interface OpenAIResearchInput {
  physicianName: string;
  specialty: string;
  organization?: string;
  city?: string;
  state?: string;
  publicContext?: string;
}

export interface OpenAIResearchOutput {
  physician_summary: string;
  current_employer?: string;
  practice_size?: string;
  hospital_affiliations: string[];
  publications: { title: string; year?: number }[];
  speaking_appearances: { title: string; event?: string; year?: number }[];
  conference_participation: { name: string; year?: number; role?: string }[];
  inferred_factors?: Record<string, boolean | string | number>;
  lead_score?: number;
}

export interface OutreachDraftInput {
  physician: {
    first_name: string;
    last_name: string;
    specialty: string;
    subspecialty?: string | null;
    city?: string | null;
    state?: string | null;
    organization?: string | null;
    physician_summary?: string | null;
  };
  channel: "email" | "linkedin" | "voicemail";
  opportunityNotes?: string;
}
