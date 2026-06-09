import { describe, it, expect } from "vitest";
import { isPhysicianDirectEmail } from "@/lib/email-validation";

/** Real high-confidence samples from production — most should be rejected. */
const SAMPLES = [
  { name: "KISHORE ARCOT", email: "memphiscardiology@gmail.com", valid: false },
  { name: "MOHAMMAD ALQARQAZ", email: "interventionalcvfellow@hfhs.org", valid: false },
  {
    name: "WILLIAM BIMSON",
    email: "dha.tripler.tripler-amc.mbx.customer-relations-office@health.mil",
    valid: false,
  },
  { name: "CHADI AYOUB", email: "emailayoub.chadi@mayo.edu", valid: false },
  { name: "CHADI AYOUB", email: "ayoub.chadi@mayo.edu", valid: true },
  { name: "CULLEN BUCHANAN", email: "chair@medicine.wisc.edu", valid: false },
  { name: "SELWIN ABRAHAM", email: "vitruvianhealth@hhcs.org", valid: false },
  { name: "EZAD AHMAD", email: "vitruvianhealth@hhcs.org", valid: false },
  { name: "SHANNON MCCONNAUGHEY", email: "lorrainem@slhs.org", valid: false },
  { name: "KATHLEEN EVANS", email: "kathleen.evans@opd.chio.gov", valid: true },
  { name: "VAQAR ALI", email: "scataleta@firstcoastcardio.com", valid: false },
  { name: "MILEYDIS ALONSO", email: "snipeld@ccf.org", valid: false },
  { name: "LEON BLUE", email: "cfit@harding.edu", valid: false },
  { name: "SCOTT EBENHOEH", email: "cmcvey@alaskaheart.com", valid: false },
] as const;

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return {
    first: parts[0] ?? "",
    last: parts.slice(1).join(" ") || (parts[0] ?? ""),
  };
}

describe("production physician email samples", () => {
  for (const sample of SAMPLES) {
    const { first, last } = splitName(sample.name);
    it(`${sample.valid ? "accepts" : "rejects"} ${sample.email} for Dr. ${sample.name}`, () => {
      expect(isPhysicianDirectEmail(sample.email, first, last)).toBe(sample.valid);
    });
  }
});
