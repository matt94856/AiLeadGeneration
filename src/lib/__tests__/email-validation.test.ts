import { describe, it, expect } from "vitest";
import {
  emailDomain,
  emailDomainMatchesSourceUrl,
  isValidEmailSyntax,
  validateEmailDomain,
  isPhysicianDirectEmail,
  validateHighConfidenceEmail,
  validationMessage,
} from "@/lib/email-validation";

describe("email-validation", () => {
  it("parses domain from email", () => {
    expect(emailDomain("abdul.abbasi@abbasimd.com")).toBe("abbasimd.com");
  });

  it("rejects invalid syntax", async () => {
    const result = await validateEmailDomain("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_syntax");
  });

  it("rejects non-existent domains (NXDOMAIN)", async () => {
    const result = await validateEmailDomain(
      "test@this-domain-definitely-does-not-exist-xyz123.invalid"
    );
    expect(result.valid).toBe(false);
    expect(["domain_not_found", "no_mail_dns"]).toContain(result.reason);
    expect(validationMessage(result)).toMatch(/does not exist|no mail servers/i);
  });

  it("accepts domains with MX records", async () => {
    const result = await validateEmailDomain("contact@uab.edu");
    expect(result.valid).toBe(true);
    expect(result.domain).toBe("uab.edu");
  });

  it("validates syntax helper", () => {
    expect(isValidEmailSyntax("test@example.com")).toBe(true);
    expect(isValidEmailSyntax("bad@")).toBe(false);
  });

  it("matches source url domain", () => {
    expect(
      emailDomainMatchesSourceUrl(
        "jane.doe@bayheart.org",
        "https://bayheart.org/team/jane-doe"
      )
    ).toBe(true);
  });

  it("rejects high confidence when email not in source text", () => {
    const result = validateHighConfidenceEmail({
      email: "jude.ediae@iim-africa.org",
      sourceUrl: "https://iim-africa.org/staff",
      sourceTexts: ["some unrelated page without the email"],
      organizations: ["Bayhealth"],
      firstName: "Jude",
      lastName: "Ediae",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_in_source_text");
  });

  it("rejects generic inboxes even when AI marks high confidence", () => {
    const result = validateHighConfidenceEmail({
      email: "info@bayheart.org",
      sourceUrl: "https://bayheart.org/contact",
      sourceTexts: ["Reach us at info@bayheart.org"],
      organizations: ["Bay Heart"],
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("generic_inbox");
  });

  it("rejects form placeholder emails", () => {
    expect(isPhysicianDirectEmail("phpp@contactus.com", "Jane", "Doe")).toBe(false);
  });

  it("accepts high confidence when email is on employer page", () => {
    const result = validateHighConfidenceEmail({
      email: "jane.doe@bayheart.org",
      sourceUrl: "https://bayheart.org/team/jane-doe",
      sourceTexts: ["Contact jane.doe@bayheart.org for appointments"],
      organizations: ["Bay Heart"],
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.ok).toBe(true);
  });
});
