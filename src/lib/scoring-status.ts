import type { Physician } from "@/types";

export type ScoringStatus = "pending" | "processing" | "complete" | "failed";

export function getScoringStatus(physician: Physician): ScoringStatus | null {
  const status = physician.research_metadata?.scoring_status;
  if (
    status === "pending" ||
    status === "processing" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }
  return null;
}

export function isScoringPending(physician: Physician): boolean {
  const status = getScoringStatus(physician);
  if (status === "pending" || status === "processing") return true;
  return physician.lead_score === 0 && status !== "complete" && status !== "failed";
}

export function hasAiFoundEmail(physician: Physician): boolean {
  const meta = physician.research_metadata?.email_enrichment as
    | { ai_suggested?: boolean; email?: string }
    | undefined;
  return Boolean(meta?.ai_suggested && physician.email?.trim());
}
