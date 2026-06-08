import { promises as dns } from "dns";

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
