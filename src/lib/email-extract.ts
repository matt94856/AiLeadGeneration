const EMAIL_REGEX =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+\b/g;

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

const BLOCKED_EMAIL_PREFIXES = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "support@",
  "info@",
  "contact@",
  "admin@",
  "webmaster@",
  "help@",
  "sales@",
  "marketing@",
];

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of matches) {
    const email = raw.toLowerCase().trim();
    if (seen.has(email)) continue;
    if (BLOCKED_EMAIL_PREFIXES.some((p) => email.startsWith(p))) continue;
    if (email.endsWith(".png") || email.endsWith(".jpg")) continue;
    seen.add(email);
    results.push(email);
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
