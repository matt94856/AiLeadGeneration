import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getRecruiterProfile, formatRecruiterPromptBlock } from "@/lib/recruiter-profile";

describe("getRecruiterProfile", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.RECRUITER_FULL_NAME;
    delete process.env.RECRUITER_WEBSITE;
  });

  afterEach(() => {
    process.env = env;
  });

  it("uses default recruiter details", () => {
    const profile = getRecruiterProfile();
    expect(profile.fullName).toBe("Matthew Fuller");
    expect(profile.email).toBe("matthewfuller389@gmail.com");
    expect(profile.phone).toBe("3522936242");
    expect(profile.website).toBe("https://locumcareerhub.com");
  });

  it("normalizes website without protocol", () => {
    process.env.RECRUITER_WEBSITE = "example.com";
    expect(getRecruiterProfile().website).toBe("https://example.com");
  });

  it("includes recruiter in prompt block", () => {
    const block = formatRecruiterPromptBlock(getRecruiterProfile());
    expect(block).toContain("Matthew Fuller");
    expect(block).toContain("matthewfuller389@gmail.com");
    expect(block).toContain("locumcareerhub.com");
  });
});
