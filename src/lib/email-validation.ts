import { promises as dns } from "dns";
import {
  emailLocalPart,
  isGenericInboxEmail,
  isOrgOrRoleInbox,
  normalizeScrapedEmail,
} from "@/lib/email-extract";
import { emailLocalPartMatchesPhysician } from "@/lib/email-local-formats";

export { emailLocalPartMatchesPhysician } from "@/lib/email-local-formats";

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  domain?: string;
}

const EMAIL_SYNTAX =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+$/;

/** Returns the domain part of an email, lowercased. */
export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

export function isValidEmailSyntax(email: string): boolean {
  return EMAIL_SYNTAX.test(email.trim());
}

/**
 * Verifies the recipient domain exists and accepts mail (MX or fallback A record).
 * Catches NXDOMAIN / typo domains like abbasimd.com before send.
 */
export async function validateEmailDomain(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmailSyntax(trimmed)) {
    return { valid: false, reason: "invalid_syntax" };
  }

  const domain = emailDomain(trimmed);
  if (!domain) {
    return { valid: false, reason: "missing_domain" };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) {
      return { valid: true, domain };
    }
    return { valid: false, reason: "no_mx_records", domain };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND") {
      try {
        await dns.resolve4(domain);
        return { valid: true, domain, reason: "a_record_fallback" };
      } catch {
        return {
          valid: false,
          reason: code === "ENOTFOUND" ? "domain_not_found" : "no_mail_dns",
          domain,
        };
      }
    }
    return { valid: false, reason: "dns_lookup_failed", domain };
  }
}

/** True when the exact email appears in scraped text or regex candidate list. */
export function emailFoundInSources(email: string, sources: string[]): boolean {
  const cleaned = normalizeScrapedEmail(email);
  const raw = email.trim().toLowerCase();
  if (!cleaned) return false;

  return sources.some((source) => {
    const s = source.toLowerCase();
    if (s.includes(cleaned) || s.includes(raw)) return true;

    const local = emailLocalPart(cleaned);
    if (!local) return false;
    return (
      s.includes(`email: ${local}`) ||
      s.includes(`email ${local}`) ||
      s.includes(`e-mail: ${local}`) ||
      s.includes(`mailto:${local}`)
    );
  });
}

function domainTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/** Email domain matches employer/org name tokens (e.g. bayheart.org ↔ Bay Heart). */
export function emailDomainAlignsWithOrganizations(
  email: string,
  organizations: string[]
): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;

  const domainKey = domain.replace(/[^a-z0-9]/g, "");
  const trustedMedical =
    /\.(edu|org)$/.test(domain) ||
    /health|hospital|medical|clinic|care|heart|cardio|medicine/.test(domain);

  for (const org of organizations) {
    const orgKey = org.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (orgKey.length >= 4 && domainKey.includes(orgKey.slice(0, 8))) return true;

    for (const token of domainTokens(org)) {
      if (token.length >= 4 && domainKey.includes(token)) return true;
    }
  }

  return trustedMedical && organizations.length > 0;
}

/** Email domain matches the hostname of the page where it was found. */
export function emailDomainMatchesSourceUrl(email: string, sourceUrl: string | null | undefined): boolean {
  if (!sourceUrl?.trim()) return false;
  const domain = emailDomain(email);
  if (!domain) return false;

  try {
    const host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

/** Direct physician inbox — not a shared department or form placeholder. */
/** True when label prefix was merged into local part and should be stripped before use. */
export function hasMergedEmailLabelPrefix(email: string): boolean {
  const raw = email.trim().toLowerCase();
  const cleaned = normalizeScrapedEmail(email);
  return raw !== cleaned && /^email|^e-mail|^mailto|^mail/.test(emailLocalPart(raw));
}

export function isPhysicianDirectEmail(
  email: string,
  firstName: string,
  lastName: string
): boolean {
  if (hasMergedEmailLabelPrefix(email)) return false;

  const cleaned = normalizeScrapedEmail(email);
  if (isGenericInboxEmail(cleaned)) return false;
  if (isOrgOrRoleInbox(cleaned, firstName, lastName)) return false;
  return emailLocalPartMatchesPhysician(cleaned, firstName, lastName);
}

export interface HighConfidenceEmailCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Gate for auto-saving AI-found emails: must be high confidence with literal
 * page evidence and a domain tied to the source page or employer.
 */
export function validateHighConfidenceEmail(input: {
  email: string;
  sourceUrl: string | null | undefined;
  sourceTexts: string[];
  organizations: string[];
  firstName: string;
  lastName: string;
}): HighConfidenceEmailCheck {
  const email = normalizeScrapedEmail(input.email);

  if (isGenericInboxEmail(email)) {
    return { ok: false, reason: "generic_inbox" };
  }

  if (!emailFoundInSources(email, input.sourceTexts)) {
    return { ok: false, reason: "not_in_source_text" };
  }

  if (!input.sourceUrl?.trim()) {
    return { ok: false, reason: "missing_source_url" };
  }

  if (!emailDomainMatchesSourceUrl(email, input.sourceUrl)) {
    const aligns = emailDomainAlignsWithOrganizations(email, input.organizations);
    const nameMatch = emailLocalPartMatchesPhysician(
      email,
      input.firstName,
      input.lastName
    );
    if (!aligns || !nameMatch) {
      return { ok: false, reason: "domain_mismatch" };
    }
  }

  if (!isPhysicianDirectEmail(email, input.firstName, input.lastName)) {
    return { ok: false, reason: "not_physician_direct" };
  }

  return { ok: true };
}

export function validationMessage(result: EmailValidationResult): string {
  switch (result.reason) {
    case "invalid_syntax":
      return "Email address format is invalid.";
    case "domain_not_found":
      return "Email domain does not exist (likely typo or outdated listing).";
    case "no_mx_records":
    case "no_mail_dns":
      return "Email domain has no mail servers configured.";
    case "dns_lookup_failed":
      return "Could not verify email domain — try again or use a different address.";
    default:
      return result.valid ? "Email domain looks valid." : "Email could not be verified.";
  }
}
