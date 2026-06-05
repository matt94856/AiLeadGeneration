import { describe, it, expect } from "vitest";
import {
  extractEmailsFromText,
  rankOfficialUrls,
  scoreEmailForPhysician,
} from "@/lib/email-extract";

describe("email-extract", () => {
  it("extracts emails from text", () => {
    const emails = extractEmailsFromText(
      "Contact Dr. Smith at john.smith@mayo.edu or info@mayo.edu"
    );
    expect(emails).toContain("john.smith@mayo.edu");
    expect(emails).not.toContain("info@mayo.edu");
  });

  it("ranks official urls", () => {
    const ranked = rankOfficialUrls([
      "https://linkedin.com/in/dr-smith",
      "https://hospital.org/physicians/john-smith",
      "https://random-blog.com/post",
    ]);
    expect(ranked[0]).toContain("hospital.org");
  });

  it("scores physician-aligned emails higher", () => {
    const high = scoreEmailForPhysician("john.smith@bayheart.org", {
      last_name: "Smith",
      first_name: "John",
      organizations: ["Bay Heart Institute"],
    });
    const low = scoreEmailForPhysician("news@google.com", {
      last_name: "Smith",
      first_name: "John",
      organizations: ["Bay Heart Institute"],
    });
    expect(high).toBeGreaterThan(low);
  });
});
