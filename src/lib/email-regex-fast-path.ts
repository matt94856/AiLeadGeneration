import { extractEmailsFromText, normalizeScrapedEmail, scoreEmailForPhysician } from "@/lib/email-extract";
import { validateHighConfidenceEmail } from "@/lib/email-validation";
import type { EmailExtractionOutput } from "@/services/enrichment/types";

interface FetchedPage {
  url: string;
  text: string;
}

interface RegexFastPathInput {
  fetchedPages: FetchedPage[];
  firstName: string;
  lastName: string;
  organizations: string[];
}

/**
 * When a scraped page already contains a physician-direct email that passes
 * strict validation, skip the OpenAI extraction call.
 */
export function tryRegexFastPath(input: RegexFastPathInput): EmailExtractionOutput | null {
  const rankedPages = [...input.fetchedPages].sort((a, b) => b.text.length - a.text.length);

  for (const page of rankedPages) {
    const emails = extractEmailsFromText(page.text);
    const ranked = [...emails].sort(
      (a, b) =>
        scoreEmailForPhysician(b, {
          last_name: input.lastName,
          first_name: input.firstName,
          organizations: input.organizations,
        }) -
        scoreEmailForPhysician(a, {
          last_name: input.lastName,
          first_name: input.firstName,
          organizations: input.organizations,
        })
    );

    for (const raw of ranked) {
      const cleaned = normalizeScrapedEmail(raw);
      const check = validateHighConfidenceEmail({
        email: cleaned,
        sourceUrl: page.url,
        sourceTexts: [page.text],
        organizations: input.organizations,
        firstName: input.firstName,
        lastName: input.lastName,
      });

      if (check.ok) {
        return {
          email: cleaned,
          confidence: "high",
          source_url: page.url,
          evidence: "Regex fast-path: email listed on fetched profile page",
        };
      }
    }
  }

  return null;
}
