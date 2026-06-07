import { describe, it, expect } from "vitest";
import {
  buildPhysicianContextBlock,
  getOutreachSystemPrompt,
} from "@/lib/outreach-prompts";
import { getRecruiterProfile } from "@/lib/recruiter-profile";
import type { Physician } from "@/types";

const physician: Physician = {
  id: "p1",
  npi: "123",
  first_name: "Jane",
  last_name: "Doe",
  specialty: "Cardiology",
  subspecialty: "Interventional",
  city: "Tampa",
  state: "FL",
  organization: "Bay Heart Institute",
  years_in_practice: 12,
  email: "jane@example.com",
  phone: null,
  linkedin_url: null,
  website: null,
  source: "npi",
  lead_score: 72,
  status: "new_lead",
  physician_summary: "Interventional cardiologist with academic affiliations.",
  research_metadata: {},
  scoring_factors: { prior_locums_indicators: true },
  assigned_to: null,
  last_contacted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("outreach prompts", () => {
  it("includes open-rate and personalization guidance in system prompt", () => {
    const prompt = getOutreachSystemPrompt(getRecruiterProfile());
    expect(prompt).toContain("OPEN RATE");
    expect(prompt).toContain("opposed to");
    expect(prompt).toContain("nationwide");
    expect(prompt).toContain("THE HOOK");
    expect(prompt).toContain("BANNED");
    expect(prompt).toContain("I hope this email finds you well");
  });

  it("includes physician research details in context block", () => {
    const block = buildPhysicianContextBlock(physician, {
      current_employer: "Bay Heart Institute",
      hospital_affiliations: ["Tampa General"],
    });
    expect(block).toContain("Dr. Jane Doe");
    expect(block).toContain("Tampa General");
    expect(block).toContain("Prior locum tenens");
  });
});
