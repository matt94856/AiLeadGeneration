import { describe, it, expect } from "vitest";
import { inferEmployerDomains, resolveEmployerDomain } from "@/lib/employer-domains";

describe("employer-domains", () => {
  it("resolves known hospital domains", () => {
    expect(resolveEmployerDomain("Mayo Clinic")).toBe("mayoclinic.org");
    expect(resolveEmployerDomain("University of Alabama")).toBe("uab.edu");
  });

  it("guesses compact org domains", () => {
    expect(resolveEmployerDomain("Bay Heart")).toBe("bayheart.org");
  });

  it("returns unique domains for employer and affiliations", () => {
    const domains = inferEmployerDomains(["Bay Heart", "Regional Medical Center"]);
    expect(domains).toContain("bayheart.org");
    expect(new Set(domains).size).toBe(domains.length);
  });
});
