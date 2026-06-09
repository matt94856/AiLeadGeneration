import { emailLocalPart } from "@/lib/email-extract";

/**
 * Common university / hospital email local-part patterns (varies by institution).
 * Sources: Emory, Michigan Medicine, UChicago, Penn Medicine, UAMS institutional formats.
 *
 * Supported patterns:
 * - first.last, first_last, first-last, firstlast
 * - flast, f.last, f_last, f-last  (initial + last — very common at .edu)
 * - firstl, first.l               (first + last initial)
 * - lastf, last.f, last_f         (last + first initial)
 * - last.first, last_first, lastfirst
 * - last, first                   (standalone — only when name length >= 4)
 * - optional numeric suffix       (jdoe2@ when address taken)
 */

function cleanName(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

/** Local part before + tag, lowercased, separators preserved. */
export function normalizeLocalPart(email: string): string {
  let local = emailLocalPart(email).toLowerCase();
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  return local.replace(/[^a-z0-9._-]/g, "");
}

export function buildPhysicianEmailLocalPatterns(
  firstName: string,
  lastName: string
): string[] {
  const first = cleanName(firstName);
  const last = cleanName(lastName);
  if (!last || last.length < 3 || !first) return [];

  const f = first[0] ?? "";
  const l = last[0] ?? "";
  const patterns = new Set<string>();

  if (first.length >= 2) {
    patterns.add(`${first}.${last}`);
    patterns.add(`${first}_${last}`);
    patterns.add(`${first}-${last}`);
    patterns.add(`${first}${last}`);
    patterns.add(`${first}.${l}`);
    patterns.add(`${first}${l}`);
    patterns.add(`${last}${first}`);
    patterns.add(`${last}.${first}`);
    patterns.add(`${last}_${first}`);
    patterns.add(`${last}-${first}`);
  }

  if (f) {
    patterns.add(`${f}${last}`);
    patterns.add(`${f}.${last}`);
    patterns.add(`${f}_${last}`);
    patterns.add(`${f}-${last}`);
    patterns.add(`${f}${l}`);
    patterns.add(`${last}${f}`);
    patterns.add(`${last}.${f}`);
    patterns.add(`${last}_${f}`);
    patterns.add(`${last}-${f}`);
    patterns.add(`${l}${first}`);
  }

  if (last.length >= 3) {
    patterns.add(last);
  }

  if (first.length >= 4) {
    patterns.add(first);
  }

  return [...patterns];
}

function compact(value: string): string {
  return value.replace(/[._-]/g, "");
}

function localMatchesPattern(local: string, pattern: string): boolean {
  if (local === pattern) return true;

  const localCompact = compact(local);
  const patternCompact = compact(pattern);
  if (localCompact === patternCompact) return true;

  if (patternCompact.length >= 4 && localCompact.startsWith(patternCompact)) {
    const suffix = localCompact.slice(patternCompact.length);
    if (/^\d{1,3}$/.test(suffix)) return true;
  }

  return false;
}

/** True when local part matches a known academic/professional naming pattern. */
export function emailLocalPartMatchesPhysician(
  email: string,
  firstName: string,
  lastName: string
): boolean {
  const local = normalizeLocalPart(email);
  if (!local || local.length < 2) return false;

  const patterns = buildPhysicianEmailLocalPatterns(firstName, lastName);
  return patterns.some((pattern) => localMatchesPattern(local, pattern));
}
