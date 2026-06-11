import type { Physician } from "@/types";
import { STALE_PROCESSING_MS } from "@/lib/batch-config";

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

export function physicianNeedsScoring(physician: Physician): boolean {
  const status = physician.research_metadata?.scoring_status;

  if (status === "processing") {
    const updated = new Date(physician.updated_at).getTime();
    if (Date.now() - updated < STALE_PROCESSING_MS) return false;
    return true;
  }

  if (status === "complete" && physician.lead_score > 0) return false;
  if (status === "pending" || status === "failed") return true;
  return physician.lead_score === 0;
}

export function physicianNeedsEmail(
  physician: Physician,
  options?: { overwrite?: boolean }
): boolean {
  if (physician.email?.trim()) return false;
  if (options?.overwrite) return true;

  const enrichment = physician.research_metadata?.email_enrichment as
    | { enriched_at?: string }
    | undefined;
  return !enrichment?.enriched_at;
}

export function hasAiFoundEmail(physician: Physician): boolean {
  const meta = physician.research_metadata?.email_enrichment as
    | { ai_suggested?: boolean; email?: string }
    | undefined;
  return Boolean(meta?.ai_suggested && physician.email?.trim());
}

export function physicianNeedsPhone(
  physician: Physician,
  options?: { overwrite?: boolean }
): boolean {
  if (options?.overwrite) return true;

  const enrichment = physician.research_metadata?.phone_enrichment as
    | { enriched_at?: string }
    | undefined;
  return !enrichment?.enriched_at;
}

export function getPhoneConfidence(physician: Physician): string | null {
  const meta = physician.research_metadata?.phone_enrichment as
    | { confidence?: string }
    | undefined;
  return meta?.confidence ?? (physician.phone ? "practice" : null);
}

export function hasProfileListedPhone(physician: Physician): boolean {
  return getPhoneConfidence(physician) === "profile_listed" && Boolean(physician.phone?.trim());
}
