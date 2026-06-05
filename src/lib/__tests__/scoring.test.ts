import { describe, it, expect } from "vitest";
import { calculateLeadScore, inferScoringFactors, resolveLeadScore } from "@/lib/scoring";
import type { ScoringWeight } from "@/types";

const weights: ScoringWeight[] = [
  { id: "1", factor_key: "retirement_proximity", label: "Retirement", weight: 20, description: null, is_active: true },
  { id: "2", factor_key: "prior_locums_indicators", label: "Locums", weight: 40, description: null, is_active: true },
];

describe("calculateLeadScore", () => {
  it("returns 0 when no factors match", () => {
    expect(calculateLeadScore({}, weights)).toBe(0);
  });

  it("normalizes to 100 when all active factors match", () => {
    expect(
      calculateLeadScore(
        { retirement_proximity: true, prior_locums_indicators: true },
        weights
      )
    ).toBe(100);
  });

  it("calculates partial score", () => {
    expect(calculateLeadScore({ prior_locums_indicators: true }, weights)).toBe(67);
  });
});

describe("resolveLeadScore", () => {
  it("blends formula and AI scores", () => {
    expect(
      resolveLeadScore({ prior_locums_indicators: true }, weights, 80)
    ).toBe(74);
  });
});

describe("inferScoringFactors", () => {
  it("infers retirement for 25+ years", () => {
    const factors = inferScoringFactors({ years_in_practice: 28 });
    expect(factors.retirement_proximity).toBe(true);
  });
});
