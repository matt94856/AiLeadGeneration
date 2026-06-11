const US_PHONE_REGEX =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

const LABELED_PHONE_REGEX =
  /(?:phone|tel|telephone|office|clinic|call)\s*[:.]?\s*((?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4})/gi;

const TOLL_FREE_PREFIXES = ["800", "888", "877", "866", "855", "844", "833"];

const GENERIC_PHONE_LABELS = [
  "appointments",
  "appointment",
  "scheduling",
  "referral",
  "referrals",
  "main",
  "central",
  "switchboard",
  "operator",
  "contact us",
  "customer service",
  "billing",
  "fax",
  "facsimile",
];

export type PhoneListingType = "profile_listed" | "practice" | "department";

/** Normalize to E.164-ish display: (XXX) XXX-XXXX */
export function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return null;
  if (TOLL_FREE_PREFIXES.some((p) => normalized.startsWith(p))) return null;

  const area = normalized.slice(0, 3);
  const prefix = normalized.slice(3, 6);
  const line = normalized.slice(6);
  return `(${area}) ${prefix}-${line}`;
}

export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function extractPhonesFromText(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const add = (raw: string) => {
    const normalized = normalizeUsPhone(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    results.push(normalized);
  };

  for (const match of text.match(US_PHONE_REGEX) ?? []) {
    add(match);
  }

  for (const match of text.matchAll(LABELED_PHONE_REGEX)) {
    if (match[1]) add(match[1]);
  }

  return results;
}

export function isGenericPhoneListing(textAround: string): boolean {
  const lower = textAround.toLowerCase();
  if (/\bfax\b|\bfacsimile\b/.test(lower)) return true;
  return GENERIC_PHONE_LABELS.some((label) => lower.includes(label));
}

export function scorePhoneForPhysician(
  phone: string,
  pageText: string,
  context: {
    first_name: string;
    last_name: string;
    organizations?: string[];
  }
): number {
  const digits = phoneDigits(phone);
  const idx = pageText.search(digits.slice(0, 3));
  const window =
    idx >= 0
      ? pageText.slice(Math.max(0, idx - 200), idx + 200)
      : pageText.slice(0, 400);

  const lower = window.toLowerCase();
  const last = context.last_name.toLowerCase();
  const first = context.first_name.toLowerCase();
  let score = 0;

  if (lower.includes(last)) score += 5;
  if (first && lower.includes(first)) score += 2;
  if (lower.includes("dr.") || lower.includes("dr ")) score += 1;
  if (/office|direct|clinic|profile|physician|provider/.test(lower)) score += 2;
  if (isGenericPhoneListing(lower)) score -= 6;

  const orgs = (context.organizations ?? []).map((o) => o.toLowerCase());
  for (const org of orgs) {
    const token = org.replace(/[^a-z0-9]/g, "");
    if (token.length >= 4 && lower.includes(token.slice(0, 8))) score += 1;
  }

  const occurrences = (pageText.match(new RegExp(digits.slice(0, 3), "g")) ?? []).length;
  if (occurrences >= 4) score -= 3;

  return score;
}

export function phoneFoundInText(phone: string, text: string): boolean {
  const digits = phoneDigits(phone);
  const textDigits = text.replace(/\D/g, "");
  return textDigits.includes(digits);
}
