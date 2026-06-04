export type EmailConfidence = "high" | "medium" | "low" | "none";

export interface EmailEnrichmentResult {
  physician_id: string;
  email: string | null;
  confidence: EmailConfidence;
  source_url: string | null;
  evidence: string | null;
  search_query: string;
  status: "found" | "not_found" | "skipped_has_email" | "error";
  error?: string;
}

export interface EmailExtractionInput {
  first_name: string;
  last_name: string;
  specialty: string;
  organization?: string | null;
  city?: string | null;
  state?: string | null;
  npi?: string | null;
  website?: string | null;
  searchSnippets: string[];
}

export interface EmailExtractionOutput {
  email: string | null;
  confidence: EmailConfidence;
  source_url: string | null;
  evidence: string | null;
}
