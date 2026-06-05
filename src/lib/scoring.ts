import type { ScoringFactorKey, ScoringWeight } from "@/types";
import { clampScore } from "@/lib/utils";

export const SCORING_FACTOR_KEYS: ScoringFactorKey[] = [
  "retirement_proximity",
  "job_transition",
  "active_publications",
  "conference_participation",
  "new_organization",
  "private_practice",
  "prior_locums_indicators",
];

export function normalizeInferredFactors(
  raw: Record<string, unknown> | undefined
): Partial<Record<ScoringFactorKey, boolean>> {
  if (!raw) return {};
  const result: Partial<Record<ScoringFactorKey, boolean>> = {};
  for (const key of SCORING_FACTOR_KEYS) {
    const val = raw[key];
    if (val === true || val === "true" || val === 1 || val === "1") {
      result[key] = true;
    }
  }
  return result;
}

export function resolveLeadScore(
  factors: Partial<Record<ScoringFactorKey, boolean>>,
  weights: ScoringWeight[],
  aiScore?: number | null
): number {
  const formulaScore = calculateLeadScore(factors, weights);
  if (aiScore != null && Number.isFinite(aiScore)) {
    const normalizedAi = clampScore(aiScore);
    if (formulaScore > 0 && normalizedAi > 0) {
      return clampScore(Math.round((formulaScore + normalizedAi) / 2));
    }
    return Math.max(formulaScore, normalizedAi);
  }
  return formulaScore;
}

export function calculateLeadScore(
  factors: Partial<Record<ScoringFactorKey, boolean>>,
  weights: ScoringWeight[]
): number {
  const activeWeights = weights.filter((w) => w.is_active);
  let total = 0;
  let maxPossible = 0;

  for (const weight of activeWeights) {
    const key = weight.factor_key as ScoringFactorKey;
    maxPossible += weight.weight;
    if (factors[key]) {
      total += weight.weight;
    }
  }

  if (maxPossible === 0) return 0;
  const normalized = (total / maxPossible) * 100;
  return clampScore(normalized);
}

export function inferScoringFactors(input: {
  years_in_practice?: number | null;
  organization?: string | null;
  research?: {
    publications?: unknown[];
    conference_participation?: unknown[];
    practice_size?: string | null;
  };
  metadata?: Record<string, unknown>;
}): Partial<Record<ScoringFactorKey, boolean>> {
  const factors: Partial<Record<ScoringFactorKey, boolean>> = {};
  const years = input.years_in_practice ?? 0;

  if (years >= 25) factors.retirement_proximity = true;
  if (input.metadata?.job_transition === true) factors.job_transition = true;
  if ((input.research?.publications?.length ?? 0) > 0) factors.active_publications = true;
  if ((input.research?.conference_participation?.length ?? 0) > 0) {
    factors.conference_participation = true;
  }
  if (input.metadata?.new_organization === true) factors.new_organization = true;
  if (
    input.research?.practice_size?.toLowerCase().includes("private") ||
    input.organization?.toLowerCase().includes("private")
  ) {
    factors.private_practice = true;
  }
  if (input.metadata?.prior_locums === true) factors.prior_locums_indicators = true;

  return factors;
}
