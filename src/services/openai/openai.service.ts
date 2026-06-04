import OpenAI from "openai";
import { logger } from "@/lib/logger";
import {
  getRecruiterProfile,
  formatRecruiterPromptBlock,
  getOutreachPlaceholderRules,
} from "@/lib/recruiter-profile";
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

Respond in JSON with keys: physician_summary (2-4 sentences), current_employer, practice_size, hospital_affiliations (array), publications (array of {title, year}), speaking_appearances (array), conference_participation (array of {name, year, role}), inferred_factors (object with boolean keys: retirement_proximity, job_transition, active_publications, conference_participation, new_organization, private_practice, prior_locums_indicators).`;

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
    const channelInstructions = {
      email:
        "Write a professional email (subject + body). Under 200 words. CAN-SPAM compliant. Include recruiter email and website in the signature.",
      linkedin:
        "Write a concise LinkedIn connection/InMail message under 100 words. Sign with the recruiter's first name.",
      voicemail:
        "Write a 30-45 second voicemail script. State the recruiter's full name and callback phone number clearly.",
    };

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You draft outreach for ${recruiter.fullName}, a ${recruiter.title} at ${recruiter.website}. Messages require human review before sending. Be compliant, respectful, and never pressure physicians.

${getOutreachPlaceholderRules(recruiter)}`,
        },
        {
          role: "user",
          content: `${channelInstructions[input.channel]}

${formatRecruiterPromptBlock(recruiter)}

Physician: Dr. ${input.physician.first_name} ${input.physician.last_name}
Specialty: ${input.physician.specialty}${input.physician.subspecialty ? ` (${input.physician.subspecialty})` : ""}
Location: ${input.physician.city ?? ""}, ${input.physician.state ?? ""}
Organization: ${input.physician.organization ?? "N/A"}
Summary: ${input.physician.physician_summary ?? "N/A"}
Opportunity notes: ${input.opportunityNotes ?? "Flexible locum cardiology coverage"}

Return JSON: { "subject": "...", "body": "..." } (subject optional for non-email).`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
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
        : "No web search results available. Return confidence none unless email explicitly appears in physician website field.";

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You extract ONLY publicly listed professional/work email addresses for physicians from search snippets.

STRICT RULES:
- NEVER invent or guess emails (no firstname.lastname@domain pattern guessing).
- Only return an email if it literally appears in the snippets or website field, or is clearly listed on an official hospital/practice page in the snippets.
- Prefer hospital, clinic, or academic emails over personal Gmail/Yahoo unless that is their only listed professional contact.
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

Public search snippets:
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
      inferred_factors: {},
    };
  }

  async generateOutreachDraft(input: OutreachDraftInput) {
    const r = getRecruiterProfile();
    const name = `Dr. ${input.physician.first_name} ${input.physician.last_name}`;
    if (input.channel === "email") {
      return {
        subject: `Locum cardiology opportunity — ${input.physician.state ?? "US"}`,
        body: `Dear ${name},\n\nI hope this message finds you well. My name is ${r.fullName}, and I'm a ${r.title}. I'm reaching out regarding flexible locum tenens cardiology opportunities that may align with your practice in ${input.physician.city ?? "your area"}.\n\nI'd welcome a brief conversation at your convenience.\n\nBest regards,\n${r.fullName}\n${r.email}\n${r.phone}\n${r.website}`,
      };
    }
    if (input.channel === "linkedin") {
      return {
        body: `Hi ${name}, I'm ${r.fullName} with Locum Career Hub (${r.website}). I help cardiologists find locum opportunities in ${input.physician.state ?? "several states"}. Would you be open to a brief connect?`,
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
