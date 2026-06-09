import { describe, it, expect } from "vitest";
import {
  extractEmailsFromText,
  isGenericInboxEmail,
  normalizeScrapedEmail,
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

  it("strips merged Email label from scraped addresses", () => {
    expect(normalizeScrapedEmail("emailayoub.chadi@mayo.edu")).toBe(
      "ayoub.chadi@mayo.edu"
    );
    const emails = extractEmailsFromText(
      "Email: ayoub.chadi@mayo.edu and emailayoub.chadi@mayo.edu"
    );
    expect(emails).toContain("ayoub.chadi@mayo.edu");
    expect(emails).not.toContain("emailayoub.chadi@mayo.edu");
  });

  it("ranks official urls", () => {
    const ranked = rankOfficialUrls([
      "https://linkedin.com/in/dr-smith",
      "https://hospital.org/physicians/john-smith",
      "https://random-blog.com/post",
    ]);
    expect(ranked[0]).toContain("hospital.org");
  });

  it("flags shared inboxes and form placeholders", () => {
    expect(isGenericInboxEmail("info@hospital.org")).toBe(true);
    expect(isGenericInboxEmail("phpp@contactus.com")).toBe(true);
    expect(isGenericInboxEmail("appointments@bayhealth.org")).toBe(true);
    expect(isGenericInboxEmail("jane.doe@bayheart.org")).toBe(false);
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
