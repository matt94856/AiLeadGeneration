import { describe, it, expect } from "vitest";
import {
  extractPhonesFromText,
  normalizeUsPhone,
  scorePhoneForPhysician,
} from "@/lib/phone-extract";

describe("phone-extract", () => {
  it("normalizes US phone numbers", () => {
    expect(normalizeUsPhone("813-555-0100")).toBe("(813) 555-0100");
    expect(normalizeUsPhone("1-800-555-0100")).toBeNull();
  });

  it("extracts phones from profile text", () => {
    const text =
      "Dr. Jane Doe, Cardiology. Office phone: (813) 555-0100. Fax: 813-555-0199";
    const phones = extractPhonesFromText(text);
    expect(phones).toContain("(813) 555-0100");
  });

  it("scores phones near physician name higher", () => {
    const text = "Dr. Jane Doe direct office (813) 555-0100";
    const score = scorePhoneForPhysician("(813) 555-0100", text, {
      first_name: "Jane",
      last_name: "Doe",
      organizations: ["Bay Heart"],
    });
    expect(score).toBeGreaterThan(4);
  });
});
