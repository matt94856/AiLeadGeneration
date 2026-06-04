import { describe, it, expect } from "vitest";
import { deduplicateRecords, physicianDedupeKey } from "@/lib/deduplication";
import type { NormalizedPhysicianInput } from "@/types";

describe("deduplication", () => {
  it("dedupes by NPI", () => {
    const records: NormalizedPhysicianInput[] = [
      { npi: "123", first_name: "John", last_name: "Doe", source: "npi" },
      { npi: "123", first_name: "John", last_name: "Doe", email: "a@b.com", source: "cms" },
    ];
    const result = deduplicateRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0]?.email).toBe("a@b.com");
  });

  it("generates stable name keys", () => {
    expect(
      physicianDedupeKey({
        first_name: "Jane",
        last_name: "Smith",
        state: "TX",
        source: "test",
      })
    ).toContain("name:jane|smith");
  });
});
