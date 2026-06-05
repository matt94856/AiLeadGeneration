import type { NormalizedPhysicianInput } from "@/types";

/** Reject org NPI rows and other records missing a real person name. */
export function sanitizePhysicianRecord(
  record: NormalizedPhysicianInput
): NormalizedPhysicianInput | null {
  const first_name = record.first_name?.trim();
  const last_name = record.last_name?.trim();

  if (!first_name || !last_name) return null;

  const invalid = new Set(["unknown", "n/a", "na", "null", "none"]);
  if (invalid.has(first_name.toLowerCase()) && invalid.has(last_name.toLowerCase())) {
    return null;
  }

  return {
    ...record,
    first_name,
    last_name,
  };
}

export function filterValidPhysicianRecords(
  records: NormalizedPhysicianInput[]
): NormalizedPhysicianInput[] {
  return records
    .map(sanitizePhysicianRecord)
    .filter((r): r is NormalizedPhysicianInput => r !== null);
}
