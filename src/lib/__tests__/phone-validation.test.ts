import { describe, it, expect } from "vitest";
import { validateProfileListedPhone, pickBestPhoneCandidate } from "@/lib/phone-validation";

describe("phone-validation", () => {
  const pageText =
    "Dr. Jane Doe, MD — Interventional Cardiology. Office: (813) 555-0100. Bay Heart Institute.";

  it("accepts phone listed near doctor name", () => {
    const result = validateProfileListedPhone({
      phone: "(813) 555-0100",
      sourceUrl: "https://bayheart.org/team/jane-doe",
      pageText,
      firstName: "Jane",
      lastName: "Doe",
      organizations: ["Bay Heart"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects appointment line context", () => {
    const result = validateProfileListedPhone({
      phone: "(813) 555-0100",
      sourceUrl: "https://bayheart.org/contact",
      pageText: "Appointments scheduling desk (813) 555-0100",
      firstName: "Jane",
      lastName: "Doe",
      organizations: ["Bay Heart"],
    });
    expect(result.ok).toBe(false);
  });

  it("picks best candidate from page", () => {
    const picked = pickBestPhoneCandidate(
      [
        {
          phone: "(813) 555-0100",
          sourceUrl: "https://bayheart.org/team/jane-doe",
          pageText,
          score: 8,
        },
      ],
      {
        firstName: "Jane",
        lastName: "Doe",
        organizations: ["Bay Heart"],
      }
    );
    expect(picked?.phone).toBe("(813) 555-0100");
    expect(picked?.listingType).toBe("profile_listed");
  });
});
