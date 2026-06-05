import { describe, it, expect } from "vitest";
import { physicianNeedsEmail, physicianNeedsScoring } from "@/lib/scoring-status";
import type { Physician } from "@/types";

function basePhysician(overrides: Partial<Physician> = {}): Physician {
  return {
    id: "p1",
    npi: null,
    first_name: "Jane",
    last_name: "Doe",
    specialty: "Cardiology",
    subspecialty: null,
    city: "Tampa",
    state: "FL",
    organization: null,
    years_in_practice: null,
    email: null,
    phone: null,
    linkedin_url: null,
    website: null,
    source: "npi",
    lead_score: 0,
    status: "new_lead",
    physician_summary: null,
    research_metadata: {},
    scoring_factors: {},
    assigned_to: null,
    last_contacted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("physicianNeedsEmail", () => {
  it("includes physicians without email and no prior enrichment", () => {
    expect(physicianNeedsEmail(basePhysician())).toBe(true);
  });

  it("excludes physicians with email", () => {
    expect(physicianNeedsEmail(basePhysician({ email: "jane@hospital.org" }))).toBe(false);
  });

  it("excludes physicians already enriched without email", () => {
    expect(
      physicianNeedsEmail(
        basePhysician({
          research_metadata: {
            email_enrichment: { enriched_at: "2025-06-01T00:00:00.000Z", ai_suggested: false },
          },
        })
      )
    ).toBe(false);
  });

  it("includes already-enriched physicians when overwrite is true", () => {
    expect(
      physicianNeedsEmail(
        basePhysician({
          research_metadata: {
            email_enrichment: { enriched_at: "2025-06-01T00:00:00.000Z" },
          },
        }),
        { overwrite: true }
      )
    ).toBe(true);
  });
});

describe("physicianNeedsScoring", () => {
  it("excludes completed physicians with a positive score", () => {
    expect(
      physicianNeedsScoring(
        basePhysician({
          lead_score: 42,
          research_metadata: { scoring_status: "complete" },
        })
      )
    ).toBe(false);
  });
});
