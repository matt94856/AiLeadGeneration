import type { NormalizedPhysicianInput } from "@/types";

export function physicianDedupeKey(record: NormalizedPhysicianInput): string {
  if (record.npi) {
    return `npi:${record.npi}`;
  }
  const name = `${record.first_name}|${record.last_name}`.toLowerCase().trim();
  const location = `${record.city ?? ""}|${record.state ?? ""}`.toLowerCase();
  const org = (record.organization ?? "").toLowerCase().trim();
  return `name:${name}|loc:${location}|org:${org}`;
}

export function deduplicateRecords(
  records: NormalizedPhysicianInput[]
): NormalizedPhysicianInput[] {
  const seen = new Map<string, NormalizedPhysicianInput>();

  for (const record of records) {
    const key = physicianDedupeKey(record);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, record);
      continue;
    }
    seen.set(key, mergePhysicianRecords(existing, record));
  }

  return Array.from(seen.values());
}

function mergePhysicianRecords(
  a: NormalizedPhysicianInput,
  b: NormalizedPhysicianInput
): NormalizedPhysicianInput {
  return {
    npi: a.npi ?? b.npi,
    first_name: a.first_name || b.first_name,
    last_name: a.last_name || b.last_name,
    specialty: a.specialty ?? b.specialty ?? "Cardiology",
    subspecialty: a.subspecialty ?? b.subspecialty,
    city: a.city ?? b.city,
    state: a.state ?? b.state,
    organization: a.organization ?? b.organization,
    years_in_practice: a.years_in_practice ?? b.years_in_practice,
    email: a.email ?? b.email,
    phone: a.phone ?? b.phone,
    linkedin_url: a.linkedin_url ?? b.linkedin_url,
    website: a.website ?? b.website,
    source: [a.source, b.source].filter(Boolean).join(","),
  };
}
