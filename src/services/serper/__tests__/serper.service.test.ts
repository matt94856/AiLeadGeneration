import { describe, it, expect } from "vitest";
import {
  cleanSearchTerm,
  isSerperCreditsError,
  quotedSearchTerm,
  sanitizeSerperQuery,
} from "@/services/serper/serper.service";

describe("sanitizeSerperQuery", () => {
  it("returns null for empty or too-short queries", () => {
    expect(sanitizeSerperQuery("")).toBeNull();
    expect(sanitizeSerperQuery("  ")).toBeNull();
    expect(sanitizeSerperQuery("ab")).toBeNull();
  });

  it("normalizes whitespace and truncates long queries", () => {
    const q = sanitizeSerperQuery("  Dr   Jane   Doe   cardiologist  ");
    expect(q).toBe("Dr Jane Doe cardiologist");
    expect(sanitizeSerperQuery("a".repeat(300))?.length).toBe(240);
  });

  it("fixes unbalanced quotes that cause Serper 400", () => {
    expect(sanitizeSerperQuery('"John Doe" "Memphis Heart email')).toBe(
      'John Doe Memphis Heart email'
    );
  });

  it("cleans employer terms for quoted queries", () => {
    expect(quotedSearchTerm('St. "Mary\'s" Hospital')).toBe("\"St. Mary's Hospital\"");
    expect(cleanSearchTerm("  Dr.  O'Brien  ")).toBe("Dr. O'Brien");
  });

  it("detects Serper out-of-credits responses", () => {
    expect(isSerperCreditsError(402, "Payment required")).toBe(true);
    expect(isSerperCreditsError(400, "Not enough credits")).toBe(true);
    expect(isSerperCreditsError(400, "Invalid query syntax")).toBe(false);
  });
});
