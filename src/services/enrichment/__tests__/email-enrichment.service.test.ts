import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailEnrichmentService } from "@/services/enrichment/email-enrichment.service";
import type { Physician } from "@/types";

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
  };
  const serper = {
    isConfigured: vi.fn(() => true),
    search: vi.fn(async () => ({
      organic: [
        {
          title: "Dr Jane Doe - Bay Heart",
          link: "https://bayheart.org/team/jane-doe",
          snippet: "Contact: jane.doe@bayheart.org",
        },
      ],
    })),
  };
  const physicians = {
    update: vi.fn(async () => physician),
    listMissingEmail: vi.fn(),
    findById: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    openai.extractProfessionalEmail.mockResolvedValue({
      email: "jane.doe@bayheart.org",
      confidence: "high",
      source_url: "https://bayheart.org/team/jane-doe",
      evidence: "Listed on hospital team page",
    });
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
});
