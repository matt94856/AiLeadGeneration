import type { NormalizedPhysicianInput, Physician } from "@/types";

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
  skip?: number;
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

export interface OutreachResearchContext {
  current_employer?: string | null;
  practice_size?: string | null;
  hospital_affiliations?: string[];
  publications?: Array<{ title?: string; year?: number }>;
  conference_participation?: Array<{ name?: string; year?: number; role?: string }>;
}

export interface OutreachDraftInput {
  physician: Physician;
  research?: OutreachResearchContext | null;
  channel: "email" | "linkedin" | "voicemail";
  opportunityNotes?: string;
}
