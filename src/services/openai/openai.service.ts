import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { getRecruiterProfile } from "@/lib/recruiter-profile";
import {
  buildOutreachUserPrompt,
  getOutreachSystemPrompt,
} from "@/lib/outreach-prompts";
import type {
  OpenAIResearchInput,
  OpenAIResearchOutput,
  OutreachDraftInput,
} from "@/services/types";
import type {
  EmailExtractionInput,
  EmailExtractionOutput,
} from "@/services/enrichment/types";

export interface IOpenAIService {
  researchPhysician(input: OpenAIResearchInput): Promise<OpenAIResearchOutput>;
  generateOutreachDraft(
    input: OutreachDraftInput
  ): Promise<{ subject?: string; body: string }>;
  generateFollowUpRecommendation(context: string): Promise<{
    recommendation: string;
    priority: "low" | "medium" | "high";
    reasoning: string;
    suggested_action_date?: string;
  }>;
  extractProfessionalEmail(input: EmailExtractionInput): Promise<EmailExtractionOutput>;
}

export class OpenAIService implements IOpenAIService {
  private client: OpenAI | null;

  constructor(apiKey?: string) {
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new Error(
        "OpenAI API key not configured. Set OPENAI_API_KEY in environment variables."
      );
    }
    return this.client;
  }

  async researchPhysician(input: OpenAIResearchInput): Promise<OpenAIResearchOutput> {
    const client = this.ensureClient();
    const prompt = `You are a medical recruiter research assistant. Based ONLY on publicly plausible information for this cardiologist, produce a structured research summary. Do not invent private contact info.

Physician: ${input.physicianName}
Specialty: ${input.specialty}
Organization: ${input.organization ?? "Unknown"}
Location: ${input.city ?? ""}, ${input.state ?? ""}
Additional context: ${input.publicContext ?? "None"}

Respond in JSON with keys: physician_summary (2-4 sentences), current_employer, practice_size, hospital_affiliations (array), publications (array of {title, year}), speaking_appearances (array), conference_participation (array of {name, year, role}), inferred_factors (object with boolean keys: retirement_proximity, job_transition, active_publications, conference_participation, new_organization, private_practice, prior_locums_indicators), lead_score (integer 0-100 estimating locum placement potential based on the factors you inferred).`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You assist locum tenens recruiters with compliant, factual physician research. Never fabricate emails or phone numbers.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");

    const parsed = JSON.parse(content) as OpenAIResearchOutput;
    logger.info("AI research completed", { physician: input.physicianName });
    return parsed;
  }

  async generateOutreachDraft(
    input: OutreachDraftInput
  ): Promise<{ subject?: string; body: string }> {
    const client = this.ensureClient();
    const recruiter = getRecruiterProfile();

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getOutreachSystemPrompt(recruiter),
        },
        {
          role: "user",
          content: buildOutreachUserPrompt(recruiter, input.physician, input.channel, {
            opportunityNotes: input.opportunityNotes,
            research: input.research,
          }),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.78,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");
    return JSON.parse(content) as { subject?: string; body: string };
  }

  async generateFollowUpRecommendation(context: string) {
    const client = this.ensureClient();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Suggest one actionable follow-up for a locum recruiter. Return JSON: recommendation, priority (low|medium|high), reasoning, suggested_action_date (ISO date).",
        },
        { role: "user", content: context },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");
    return JSON.parse(content) as {
      recommendation: string;
      priority: "low" | "medium" | "high";
      reasoning: string;
      suggested_action_date?: string;
    };
  }

  async extractProfessionalEmail(
    input: EmailExtractionInput
  ): Promise<EmailExtractionOutput> {
    const client = this.ensureClient();

    const snippetsBlock =
      input.searchSnippets.length > 0
        ? input.searchSnippets.join("\n---\n")
        : "No web search results or page content available.";

    const regexBlock =
      input.regexCandidates && input.regexCandidates.length > 0
        ? input.regexCandidates.join("\n")
        : "None";

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You verify publicly listed professional/work email addresses for a specific physician.

STRICT RULES:
- NEVER invent or guess emails (no firstname.lastname@domain pattern guessing).
- Only return an email if it literally appears in the snippets, fetched page content, regex candidates, or website field.
- The email must plausibly belong to THIS physician (name or employer match). Reject generic inboxes (info@, contact@, noreply@).
- Prefer hospital, clinic, or academic emails over personal Gmail/Yahoo when both exist.
- If uncertain, return email null and confidence "none".
- Return JSON: { "email": string|null, "confidence": "high"|"medium"|"low"|"none", "source_url": string|null, "evidence": string|null }`,
        },
        {
          role: "user",
          content: `Physician: Dr. ${input.first_name} ${input.last_name}
Specialty: ${input.specialty}
Organization: ${input.organization ?? "Unknown"}
Location: ${input.city ?? ""}, ${input.state ?? ""}
NPI: ${input.npi ?? "N/A"}
Website: ${input.website ?? "N/A"}

Emails found in page text (verify only — do not invent):
${regexBlock}

Search snippets and fetched page content:
${snippetsBlock}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { email: null, confidence: "none", source_url: null, evidence: null };
    }

    const parsed = JSON.parse(content) as EmailExtractionOutput;
    logger.info("Email extraction completed", {
      physician: `${input.first_name} ${input.last_name}`,
      found: Boolean(parsed.email),
      confidence: parsed.confidence,
    });
    return parsed;
  }
}

/** Offline fallback when OpenAI is not configured */
export class MockOpenAIService implements IOpenAIService {
  async researchPhysician(input: OpenAIResearchInput): Promise<OpenAIResearchOutput> {
    return {
      physician_summary: `${input.specialty} physician in ${input.city ?? "unknown city"}, ${input.state ?? ""}. Research pending — configure OPENAI_API_KEY for AI-enriched profiles.`,
      current_employer: input.organization,
      practice_size: "Unknown",
      hospital_affiliations: [],
      publications: [],
      speaking_appearances: [],
      conference_participation: [],
      inferred_factors: {
        private_practice: Boolean(input.organization?.toLowerCase().includes("private")),
      },
      lead_score: 35,
    };
  }

  async generateOutreachDraft(input: OutreachDraftInput) {
    const r = getRecruiterProfile();
    const name = `Dr. ${input.physician.first_name} ${input.physician.last_name}`;
    const place = input.physician.city ?? input.physician.state ?? "your area";
    const employer =
      input.research?.current_employer ?? input.physician.organization ?? "your practice";
    if (input.channel === "email") {
      return {
        subject: `${place} cardiology — quick question`,
        body: `${name} — your work at ${employer} caught my eye.\n\nI'm ${r.fullName} (${r.website}) and I place cardiologists on locums nationwide — not the usual blast-and-pray stuff.\n\nWould you be opposed to a quick chat about coverage near ${place}, or elsewhere in the U.S. if that's more your speed? A simple "not opposed" is plenty — or tell me to buzz off.\n\n${r.fullName.split(" ")[0] ?? r.fullName}\n${r.email} · ${r.phone}\n${r.website}`,
      };
    }
    if (input.channel === "linkedin") {
      return {
        body: `Hi ${name}, I'm ${r.fullName} with Locum Career Hub (${r.website}). I help cardiologists find locums in ${input.physician.state ?? "their region"} and across the U.S. Would you be opposed to a quick connect?`,
      };
    }
    return {
      body: `Hi ${name}, this is ${r.fullName}. I'm a ${r.title} with Locum Career Hub. I'm calling about locum cardiology coverage in ${input.physician.state ?? "your region"}. Please call me back at ${r.phone}, or email ${r.email}. Thank you.`,
    };
  }

  async generateFollowUpRecommendation() {
    return {
      recommendation: "Review profile and schedule qualification call",
      priority: "medium" as const,
      reasoning: "AI recommendations require OPENAI_API_KEY",
    };
  }

  async extractProfessionalEmail(input: EmailExtractionInput): Promise<EmailExtractionOutput> {
    if (input.website?.includes("@")) {
      return {
        email: input.website,
        confidence: "medium",
        source_url: input.website,
        evidence: "From physician website field",
      };
    }
    return {
      email: null,
      confidence: "none",
      source_url: null,
      evidence: "Configure OPENAI_API_KEY and SERPER_API_KEY for AI email discovery",
    };
  }
}
