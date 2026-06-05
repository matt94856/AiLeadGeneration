import { describe, it, expect } from "vitest";
import { getPageNumbers, totalPages, clampPageSize } from "@/lib/pagination";

describe("pagination", () => {
  it("calculates total pages", () => {
    expect(totalPages(140, 25)).toBe(6);
    expect(totalPages(0, 25)).toBe(1);
  });

  it("clamps page size", () => {
    expect(clampPageSize(200)).toBe(100);
    expect(clampPageSize(undefined)).toBe(25);
  });

  it("builds page numbers with ellipses", () => {
    expect(getPageNumbers(5, 10)).toContain("ellipsis");
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
