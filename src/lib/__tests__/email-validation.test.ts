import { describe, it, expect } from "vitest";
import {
  emailDomain,
  isValidEmailSyntax,
  validateEmailDomain,
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
});
