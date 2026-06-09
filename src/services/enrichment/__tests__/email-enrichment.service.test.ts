import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailEnrichmentService } from "@/services/enrichment/email-enrichment.service";
import type { Physician } from "@/types";

vi.mock("@/lib/email-validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email-validation")>();
  return {
    ...actual,
    validateEmailDomain: vi.fn(async () => ({ valid: true, domain: "bayheart.org" })),
  };
});

const physician: Physician = {
  id: "p1",
  npi: "123",
  first_name: "Jane",
  last_name: "Doe",
  specialty: "Cardiology",
  subspecialty: null,
  city: "Tampa",
  state: "FL",
  organization: "Bay Heart",
  years_in_practice: 10,
  email: null,
  phone: null,
  linkedin_url: null,
  website: null,
  source: "npi",
  lead_score: 50,
  status: "new_lead",
  physician_summary: null,
  research_metadata: {},
  scoring_factors: {},
  assigned_to: null,
  last_contacted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("EmailEnrichmentService", () => {
  const openai = {
    extractProfessionalEmail: vi.fn(),
    discoverPublicProfileUrls: vi.fn(async () => ({ urls: [], reasoning: null })),
    searchPublicDatabasesForEmail: vi.fn(async () => ({
      email: null,
      confidence: "none",
      source_url: null,
      evidence: null,
    })),
  };
  const serper = {
    isConfigured: vi.fn(() => true),
    isCreditsExhausted: vi.fn(() => false),
    search: vi.fn(async () => ({
      organic: [
        {
          title: "Dr Jane Doe - Bay Heart",
          link: "https://bayheart.org/team/jane-doe",
          snippet: "Cardiology team member",
        },
      ],
    })),
    searchMany: vi.fn(async () => [
      {
        title: "Dr Jane Doe - Bay Heart",
        link: "https://bayheart.org/team/jane-doe",
        snippet: "Cardiology team member",
      },
    ]),
  };
  const physicians = {
    update: vi.fn(async () => physician),
    listMissingEmail: vi.fn(),
    findById: vi.fn(),
    findOtherByEmail: vi.fn(async () => null),
    getResearch: vi.fn(async () => ({
      current_employer: "Bay Heart",
      hospital_affiliations: ["Regional Medical Center"],
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    openai.extractProfessionalEmail.mockResolvedValue({
      email: "jane.doe@bayheart.org",
      confidence: "high",
      source_url: "https://bayheart.org/team/jane-doe",
      evidence: "Listed on hospital team page",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("bayheart.org")) {
          return {
            ok: true,
            headers: { get: () => "text/html" },
            text: async () =>
              "<html><body>Contact jane.doe@bayheart.org for appointments</body></html>",
          };
        }
        if (url.includes("serper")) {
          return { ok: true, json: async () => ({ organic: [] }) };
        }
        return { ok: false, headers: { get: () => "" }, text: async () => "" };
      })
    );
  });

  it("finds email from public search snippets", async () => {
    const service = new EmailEnrichmentService(
      physicians as never,
      openai as never,
      serper as never
    );
    const result = await service.enrichPhysician(physician);
    expect(result.status).toBe("found");
    expect(result.email).toBe("jane.doe@bayheart.org");
    expect(physicians.update).toHaveBeenCalled();
  });

  it("uses site-scoped Serper queries for employer domain", () => {
    const service = new EmailEnrichmentService(
      physicians as never,
      openai as never,
      serper as never
    );
    const queries = service.buildSiteScopedSerperQueries(physician, {
      current_employer: "Bay Heart",
      hospital_affiliations: [],
    });
    expect(queries.some((q) => q.startsWith("site:bayheart.org"))).toBe(true);
    expect(queries.some((q) => q.includes('"Jane Doe"'))).toBe(true);
  });

  it("skips Serper when free sources already find a valid email", async () => {
    const withWebsite = { ...physician, website: "https://bayheart.org/team/jane-doe" };
    openai.extractProfessionalEmail.mockResolvedValue({
      email: null,
      confidence: "none",
      source_url: null,
      evidence: null,
    });

    const service = new EmailEnrichmentService(
      physicians as never,
      openai as never,
      serper as never
    );
    const result = await service.enrichPhysician(withWebsite);
    expect(result.status).toBe("found");
    expect(result.email).toBe("jane.doe@bayheart.org");
    expect(serper.searchMany).not.toHaveBeenCalled();
    expect(openai.extractProfessionalEmail).not.toHaveBeenCalled();
  });
});
