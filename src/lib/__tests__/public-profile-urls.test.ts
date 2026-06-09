import { describe, it, expect } from "vitest";
import {
  buildEmployerDirectoryUrls,
  buildFreeProfileSeedUrls,
  buildKnownPublicProfileUrls,
} from "@/lib/public-profile-urls";

describe("public-profile-urls", () => {
  it("includes NPI and physician website", () => {
    const urls = buildKnownPublicProfileUrls({
      npi: "1234567890",
      website: "https://drjane.example.com",
    });
    expect(urls).toContain("https://npiregistry.cms.hhs.gov/provider-view/1234567890");
    expect(urls).toContain("https://drjane.example.com");
  });

  it("builds employer directory URLs without search API", () => {
    const urls = buildEmployerDirectoryUrls({
      organization: "Bay Heart",
    });
    expect(urls.some((u) => u.includes("bayheart.org/find-a-doctor"))).toBe(true);
    expect(urls.some((u) => u.includes("bayheart.org/providers"))).toBe(true);
  });

  it("combines free seed sources", () => {
    const urls = buildFreeProfileSeedUrls({
      npi: "1234567890",
      organization: "Mayo Clinic",
      website: "https://example.com",
    });
    expect(urls.some((u) => u.includes("npiregistry"))).toBe(true);
    expect(urls.some((u) => u.includes("mayoclinic.org"))).toBe(true);
  });
});
