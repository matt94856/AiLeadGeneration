import { describe, it, expect } from "vitest";
import {
  filterValidPhysicianRecords,
  sanitizePhysicianRecord,
} from "@/lib/physician-validation";

describe("physician-validation", () => {
  it("rejects missing names", () => {
    expect(
      sanitizePhysicianRecord({
        first_name: "",
        last_name: "Smith",
        source: "npi_registry",
      })
    ).toBeNull();
  });

  it("accepts valid records", () => {
    expect(
      sanitizePhysicianRecord({
        first_name: " Jane ",
        last_name: " Doe ",
        source: "npi_registry",
      })
    ).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      source: "npi_registry",
    });
  });

  it("filters batch", () => {
    const result = filterValidPhysicianRecords([
      { first_name: "Amy", last_name: "Lee", source: "npi_registry" },
      { first_name: "", last_name: "Org", source: "npi_registry" },
    ]);
    expect(result).toHaveLength(1);
  });
});
