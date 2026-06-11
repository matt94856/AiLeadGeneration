import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhoneEnrichmentService } from "@/services/enrichment/phone-enrichment.service";
import type { Physician } from "@/types";

const physician: Physician = {
  id: "p1",
  npi: "1234567890",
  first_name: "Jane",
  last_name: "Doe",
  specialty: "Cardiology",
  subspecialty: null,
  city: "Tampa",
  state: "FL",
  organization: "Bay Heart",
  years_in_practice: 10,
  email: null,
  phone: "(813) 555-9999",
  linkedin_url: null,
  website: "https://bayheart.org/team/jane-doe",
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

describe("PhoneEnrichmentService", () => {
  const physicians = {
    update: vi.fn(async () => physician),
    getResearch: vi.fn(async () => ({
      current_employer: "Bay Heart",
      hospital_affiliations: [],
    })),
  };
  const sheets = {
    isConfigured: vi.fn(() => false),
    syncUnsyncedPhysicians: vi.fn(async () => 0),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("bayheart.org")) {
          return {
            ok: true,
            headers: { get: () => "text/html" },
            text: async () =>
              "<html><body>Dr. Jane Doe office phone (813) 555-0100</body></html>",
          };
        }
        return { ok: false, headers: { get: () => "" }, text: async () => "" };
      })
    );
  });

  it("upgrades NPI practice phone with profile-listed number", async () => {
    const service = new PhoneEnrichmentService(physicians as never, sheets as never);
    const result = await service.enrichPhysician(physician);
    expect(result.status).toBe("found");
    expect(result.phone).toBe("(813) 555-0100");
    expect(result.confidence).toBe("profile_listed");
    expect(physicians.update).toHaveBeenCalled();
  });
});
