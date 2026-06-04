import { describe, it, expect, vi, beforeEach } from "vitest";
import { NpiService } from "@/services/npi/npi.service";

describe("NpiService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes NPI API results", async () => {
    const mockResponse = {
      result_count: 1,
      results: [
        {
          number: "1234567893",
          basic: {
            first_name: "JOHN",
            last_name: "DOE",
            enumeration_date: "2010-05-01",
          },
          taxonomies: [{ desc: "Interventional Cardiology", primary: true }],
          addresses: [
            {
              city: "Tampa",
              state: "FL",
              address_purpose: "LOCATION",
              telephone_number: "813-555-0100",
            },
          ],
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })
    );

    const service = new NpiService("https://test.api");
    const results = await service.searchCardiologists({ state: "FL", limit: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]?.npi).toBe("1234567893");
    expect(results[0]?.first_name).toBe("JOHN");
    expect(results[0]?.source).toBe("npi_registry");
    expect(results[0]?.city).toBe("Tampa");
  });
});
