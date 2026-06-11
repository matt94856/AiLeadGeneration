import {
  isGenericPhoneListing,
  normalizeUsPhone,
  phoneDigits,
  phoneFoundInText,
  scorePhoneForPhysician,
} from "@/lib/phone-extract";

export interface PhoneCandidate {
  phone: string;
  sourceUrl: string;
  pageText: string;
  score: number;
}

export interface ProfilePhoneCheck {
  ok: boolean;
  reason?: string;
  listingType?: "profile_listed" | "department";
}

export function isUsableOrganizationName(org: string | null | undefined): boolean {
  if (!org?.trim()) return false;
  const key = org.trim().toLowerCase();
  return !["unknown", "n/a", "na", "none", "null", "not available"].includes(key);
}

/**
 * Gate for saving a profile-scraped phone — must appear on the page near the doctor's name.
 */
export function validateProfileListedPhone(input: {
  phone: string;
  sourceUrl: string;
  pageText: string;
  firstName: string;
  lastName: string;
  organizations: string[];
}): ProfilePhoneCheck {
  const phone = normalizeUsPhone(input.phone);
  if (!phone) return { ok: false, reason: "invalid_format" };

  if (!input.sourceUrl?.trim()) return { ok: false, reason: "missing_source_url" };
  if (!phoneFoundInText(phone, input.pageText)) {
    return { ok: false, reason: "not_in_source_text" };
  }

  const digits = phoneDigits(phone);
  const idx = input.pageText.replace(/\D/g, "").indexOf(digits);
  const charIdx =
    idx >= 0
      ? input.pageText.search(
          new RegExp(
            digits
              .slice(0, 3)
              .split("")
              .join("\\D*")
          )
        )
      : -1;
  const window =
    charIdx >= 0
      ? input.pageText.slice(Math.max(0, charIdx - 200), charIdx + 200)
      : "";

  const last = input.lastName.toLowerCase();
  if (!window.toLowerCase().includes(last)) {
    return { ok: false, reason: "name_not_near_phone" };
  }

  if (isGenericPhoneListing(window)) {
    return { ok: false, reason: "generic_department_line", listingType: "department" };
  }

  const score = scorePhoneForPhysician(phone, input.pageText, {
    first_name: input.firstName,
    last_name: input.lastName,
    organizations: input.organizations,
  });

  if (score < 4) {
    return { ok: false, reason: "low_context_score" };
  }

  return { ok: true, listingType: "profile_listed" };
}

export function pickBestPhoneCandidate(
  candidates: PhoneCandidate[],
  input: {
    firstName: string;
    lastName: string;
    organizations: string[];
    existingPhone?: string | null;
  }
): { phone: string; sourceUrl: string; listingType: "profile_listed" } | null {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);

  for (const candidate of ranked) {
    const check = validateProfileListedPhone({
      phone: candidate.phone,
      sourceUrl: candidate.sourceUrl,
      pageText: candidate.pageText,
      firstName: input.firstName,
      lastName: input.lastName,
      organizations: input.organizations,
    });

    if (!check.ok) continue;

    if (
      input.existingPhone &&
      phoneDigits(input.existingPhone) === phoneDigits(candidate.phone)
    ) {
      continue;
    }

    return {
      phone: normalizeUsPhone(candidate.phone)!,
      sourceUrl: candidate.sourceUrl,
      listingType: "profile_listed",
    };
  }

  return null;
}
