import { describe, it, expect } from "vitest";
import {
  buildPhysicianEmailLocalPatterns,
  emailLocalPartMatchesPhysician,
} from "@/lib/email-local-formats";

describe("email-local-formats", () => {
  it("builds common university patterns", () => {
    const patterns = buildPhysicianEmailLocalPatterns("John", "Doe");
    expect(patterns).toContain("john.doe");
    expect(patterns).toContain("jdoe");
    expect(patterns).toContain("j.doe");
    expect(patterns).toContain("doej");
    expect(patterns).toContain("doe");
  });

  it("accepts first.last academic format", () => {
    expect(emailLocalPartMatchesPhysician("kathleen.evans@opd.chio.gov", "Kathleen", "Evans")).toBe(
      true
    );
  });

  it("accepts last.first format (Mayo-style)", () => {
    expect(emailLocalPartMatchesPhysician("ayoub.chadi@mayo.edu", "Chadi", "Ayoub")).toBe(true);
  });

  it("accepts first initial + last (FLast)", () => {
    expect(emailLocalPartMatchesPhysician("jdoe@med.umich.edu", "John", "Doe")).toBe(true);
    expect(emailLocalPartMatchesPhysician("J.Doe@emory.edu", "Jane", "Doe")).toBe(true);
  });

  it("accepts last + first initial (LastF)", () => {
    expect(emailLocalPartMatchesPhysician("doej@uphs.upenn.edu", "John", "Doe")).toBe(true);
  });

  it("accepts underscore and hyphen separators", () => {
    expect(emailLocalPartMatchesPhysician("john_doe@uams.edu", "John", "Doe")).toBe(true);
    expect(emailLocalPartMatchesPhysician("j-doe@pennmedicine.org", "John", "Doe")).toBe(true);
  });

  it("accepts numeric suffix for duplicate addresses", () => {
    expect(emailLocalPartMatchesPhysician("jdoe2@med.umich.edu", "John", "Doe")).toBe(true);
  });

  it("rejects wrong-person and shared inboxes", () => {
    expect(emailLocalPartMatchesPhysician("lorrainem@slhs.org", "Shannon", "McConnaughey")).toBe(
      false
    );
    expect(emailLocalPartMatchesPhysician("scataleta@firstcoastcardio.com", "Vaqar", "Ali")).toBe(
      false
    );
    expect(emailLocalPartMatchesPhysician("cmcvey@alaskaheart.com", "Scott", "Ebenhoeh")).toBe(
      false
    );
    expect(emailLocalPartMatchesPhysician("info@hospital.org", "Jane", "Doe")).toBe(false);
  });
});
