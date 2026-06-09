const EMAIL_REGEX =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+\b/g;

/** "Email: ayoub.chadi@mayo.edu" — label separated from address in page text. */
const LABELED_EMAIL_REGEX =
  /(?:e-?mail|mailto)\s*[:.]?\s*([A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+)/gi;

/** Page labels accidentally merged into local part (emailayoub.chadi@...). */
const SCRAPED_LOCAL_PREFIXES = ["email", "e-mail", "e_mail", "mailto", "mail"];

/**
 * Strips accidental "Email"/"mailto" label prefix from scraped addresses.
 * emailayoub.chadi@mayo.edu → ayoub.chadi@mayo.edu
 */
export function normalizeScrapedEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at).replace(/[^a-z0-9.+_-]/g, "");
  const domain = trimmed.slice(at + 1).replace(/^www\./, "");
  if (!local || !domain) return trimmed;

  for (const prefix of SCRAPED_LOCAL_PREFIXES) {
    if (!local.startsWith(prefix) || local.length <= prefix.length + 2) continue;

    const stripped = local.slice(prefix.length).replace(/^[^a-z0-9]+/, "");
    if (stripped.length >= 5 || (stripped.length >= 3 && stripped.includes("."))) {
      local = stripped;
      break;
    }
  }

  return `${local}@${domain}`;
}

export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "";
  return email.slice(0, at).toLowerCase();
}

const OFFICIAL_URL_HINTS = [
  "hospital",
  "health",
  "medical",
  "clinic",
  "cardio",
  "physician",
  "doctor",
  "provider",
  "faculty",
  "medicine",
  ".edu",
  ".org",
  "/team",
  "/staff",
  "/providers",
  "/find-a-doctor",
  "/our-doctors",
];

/** Shared inboxes and form placeholders — not a specific physician. */
export const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "contactus",
  "support",
  "admin",
  "webmaster",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "help",
  "sales",
  "marketing",
  "office",
  "appointments",
  "appointment",
  "scheduling",
  "schedule",
  "reception",
  "frontdesk",
  "billing",
  "hr",
  "careers",
  "jobs",
  "media",
  "press",
  "feedback",
  "inquiry",
  "inquiries",
  "enquiries",
  "general",
  "team",
  "patients",
  "patient",
  "registration",
  "register",
  "fax",
  "main",
  "communications",
  "referrals",
  "referral",
  "voicemail",
  "service",
  "services",
  "web",
  "online",
  "portal",
  "triage",
  "callcenter",
  "customerservice",
  "privacy",
  "legal",
  "abuse",
  "postmaster",
  "newsletter",
  "subscribe",
  "unsubscribe",
  "doctor",
  "doctors",
  "physician",
  "physicians",
  "provider",
  "providers",
  "staff",
  "directory",
  "reservations",
  "reservation",
  "phpp",
  "php",
  "javascript",
  "email",
  "mail",
  "yourname",
  "name",
  "username",
  "user",
  "test",
  "demo",
  "example",
  "sample",
  "inbox",
  "hello",
  "mailroom",
  "records",
  "medicalrecords",
  "chair",
  "fellow",
  "fellowship",
  "cfit",
  "customer",
  "relations",
]);

/** Role/org words in local part — shared inbox if physician name is absent. */
export const ROLE_OR_ORG_LOCAL_KEYWORDS = [
  "cardiology",
  "cardio",
  "fellow",
  "fellowship",
  "interventional",
  "customer",
  "relations",
  "vitruvian",
  "practice",
  "clinic",
  "medicine",
  "hospital",
  "health",
  "group",
  "associates",
  "partners",
  "institute",
  "center",
  "centre",
  "department",
  "dept",
  "program",
  "residency",
  "referral",
];

export const GENERIC_DOMAIN_HINTS = [
  "contactus",
  "contact-us",
  "formspree",
  "wufoo",
  "typeform",
  "example.com",
  "sentry.io",
  "wixpress",
  "placeholder",
  "godaddysites",
  "squarespace",
  "webflow",
  "mailinator",
  "yopmail",
  "forms.gle",
  "googleusercontent",
];

/** True for department/shared inboxes, not a direct physician address. */
export function isGenericInboxEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return true;

  const local = normalized.slice(0, at).replace(/[^a-z0-9.+_-]/g, "");
  const domain = normalized.slice(at + 1).replace(/^www\./, "");

  if (!local || !domain) return true;
  if (GENERIC_LOCAL_PARTS.has(local)) return true;

  const localRoot = local.split("+")[0]?.split(".")[0] ?? local;
  if (GENERIC_LOCAL_PARTS.has(localRoot)) return true;

  for (const hint of GENERIC_DOMAIN_HINTS) {
    if (domain.includes(hint)) return true;
  }

  if (/^(php|phpp|js|css|html|xml|mailto|your|name|user|test|demo|sample|dept|department)/.test(local)) {
    return true;
  }

  if (/^(clinic|hospital|center|centre|dept|department|team|office|appointments?|scheduling)-/.test(local)) {
    return true;
  }

  if (local.includes(".mbx.") || local.includes("customer-relations")) {
    return true;
  }

  if ((local.match(/\./g) ?? []).length >= 3 && /customer|relations|office|mbx/.test(local)) {
    return true;
  }

  return false;
}

/** Practice/department local part with no physician name (e.g. memphiscardiology@, vitruvianhealth@). */
export function isOrgOrRoleInbox(
  email: string,
  firstName: string,
  lastName: string
): boolean {
  const normalized = normalizeScrapedEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return true;

  const local = normalized.slice(0, at).replace(/[^a-z0-9.]/g, "");
  const domain = normalized.slice(at + 1);
  const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");

  const hasLast = last.length >= 3 && local.includes(last);
  const hasFirst = first.length >= 2 && local.includes(first);
  if (hasLast) return false;

  const hasRoleKeyword = ROLE_OR_ORG_LOCAL_KEYWORDS.some((kw) => local.includes(kw));
  if (hasRoleKeyword && !hasLast) return true;

  const personalDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
  if (personalDomains.some((d) => domain.endsWith(d)) && !hasLast && local.length > 8) {
    return true;
  }

  return false;
}

export function extractEmailsFromText(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const addEmail = (raw: string) => {
    const email = normalizeScrapedEmail(raw);
    if (seen.has(email)) return;
    if (isGenericInboxEmail(email)) return;
    if (email.endsWith(".png") || email.endsWith(".jpg")) return;
    seen.add(email);
    results.push(email);
  };

  for (const raw of text.match(EMAIL_REGEX) ?? []) {
    addEmail(raw);
  }

  for (const match of text.matchAll(LABELED_EMAIL_REGEX)) {
    const labeled = match[1];
    if (labeled) addEmail(labeled);
  }

  return results;
}

export function scoreEmailForPhysician(
  email: string,
  context: {
    last_name: string;
    first_name?: string;
    organizations?: string[];
  }
): number {
  const local = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  const last = context.last_name.toLowerCase();
  const first = context.first_name?.toLowerCase() ?? "";
  let score = 0;

  if (local.includes(last)) score += 3;
  if (first && local.includes(first[0] ?? "")) score += 1;
  if (first && local.includes(first)) score += 1;

  const orgs = (context.organizations ?? []).map((o) => o.toLowerCase());
  for (const org of orgs) {
    const token = org.replace(/[^a-z0-9]/g, "");
    if (token.length >= 4 && domain.replace(/[^a-z0-9]/g, "").includes(token.slice(0, 6))) {
      score += 4;
    }
  }

  if (domain.endsWith(".edu") || domain.includes("health") || domain.includes("hospital")) {
    score += 2;
  }

  if (domain.endsWith("gmail.com") || domain.endsWith("yahoo.com") || domain.endsWith("hotmail.com")) {
    score -= 1;
  }

  return score;
}

export function rankOfficialUrls(links: string[], max = 3): string[] {
  const scored = links
    .filter(isFetchableUrl)
    .map((link) => {
      const lower = link.toLowerCase();
      let score = 0;
      for (const hint of OFFICIAL_URL_HINTS) {
        if (lower.includes(hint)) score += 1;
      }
      if (lower.includes("linkedin.com") || lower.includes("facebook.com")) score -= 5;
      return { link, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const unique: string[] = [];
  for (const item of scored) {
    if (!unique.includes(item.link)) unique.push(item.link);
    if (unique.length >= max) break;
  }
  return unique;
}

export function isFetchableUrl(link: string): boolean {
  try {
    const u = new URL(link);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}
