import { EMAIL_BATCH_CHUNK } from "@/lib/batch-config";
import {
  extractEmailsFromText,
  rankOfficialUrls,
  scoreEmailForPhysician,
} from "@/lib/email-extract";
import { logger } from "@/lib/logger";
import { sleep } from "@/lib/utils";
import type { IOpenAIService } from "@/services/openai/openai.service";
import type { ISerperService } from "@/services/serper/serper.service";
import type { SerperOrganicResult } from "@/services/serper/serper.service";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { Physician } from "@/types";
import type { EmailEnrichmentResult } from "@/services/enrichment/types";
import { fetchPages } from "@/services/enrichment/page-fetch.service";

export interface EnrichBatchOptions {
  limit?: number;
  discoveredSince?: string;
  physicianIds?: string[];
  minConfidence?: "medium" | "high";
  overwrite?: boolean;
}

export interface EnrichBatchResult {
  processed: number;
  found: number;
  not_found: number;
  skipped: number;
  errors: number;
  remaining: number;
  has_more: boolean;
  results: EmailEnrichmentResult[];
}

interface ResearchContext {
  current_employer?: string | null;
  hospital_affiliations?: string[];
}

export class EmailEnrichmentService {
  constructor(
    private readonly physicians: PhysicianRepository,
    private readonly openai: IOpenAIService,
    private readonly serper: ISerperService
  ) {}

  buildSearchQueries(physician: Physician, research?: ResearchContext | null): string[] {
    const employer =
      research?.current_employer?.trim() ||
      physician.organization?.trim() ||
      undefined;
    const affiliations = (research?.hospital_affiliations ?? []).filter(Boolean);

    const queries = [
      `"${physician.first_name} ${physician.last_name}" cardiologist ${physician.city ?? ""} ${physician.state ?? ""} email`,
      `"Dr ${physician.first_name} ${physician.last_name}" ${employer ?? "cardiology"} physician contact`,
      physician.npi
        ? `"${physician.last_name}" NPI ${physician.npi} cardiologist`
        : `"${physician.first_name} ${physician.last_name}" cardiologist directory`,
    ];

    if (employer) {
      queries.push(`"${physician.first_name} ${physician.last_name}" "${employer}" email`);
    }

    for (const hospital of affiliations.slice(0, 2)) {
      queries.push(`"${physician.first_name} ${physician.last_name}" "${hospital}" physician`);
    }

    return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()))].slice(0, 5);
  }

  private buildSnippetBlocks(
    organic: SerperOrganicResult[],
    pageTexts: { url: string; text: string }[]
  ): string[] {
    const blocks: string[] = [];

    for (const row of organic.slice(0, 12)) {
      blocks.push(`[Search result]\nTitle: ${row.title}\nURL: ${row.link}\nSnippet: ${row.snippet}`);
    }

    for (const page of pageTexts) {
      blocks.push(`[Fetched page]\nURL: ${page.url}\nContent: ${page.text}`);
    }

    return blocks;
  }

  private rankRegexCandidates(
    emails: string[],
    physician: Physician,
    research?: ResearchContext | null
  ): string[] {
    const orgs = [
      physician.organization,
      research?.current_employer,
      ...(research?.hospital_affiliations ?? []),
    ].filter((v): v is string => Boolean(v?.trim()));

    return [...emails]
      .sort(
        (a, b) =>
          scoreEmailForPhysician(b, {
            last_name: physician.last_name,
            first_name: physician.first_name,
            organizations: orgs,
          }) -
          scoreEmailForPhysician(a, {
            last_name: physician.last_name,
            first_name: physician.first_name,
            organizations: orgs,
          })
      )
      .slice(0, 15);
  }

  async enrichPhysician(
    physician: Physician,
    options?: { overwrite?: boolean }
  ): Promise<EmailEnrichmentResult> {
    const research = (await this.physicians.getResearch(physician.id)) as ResearchContext | null;
    const queries = this.buildSearchQueries(physician, research);
    const searchQuery = queries[0] ?? "";

    if (physician.email?.trim() && !options?.overwrite) {
      return {
        physician_id: physician.id,
        email: physician.email,
        confidence: "high",
        source_url: null,
        evidence: "Already has email on file",
        search_query: searchQuery,
        status: "skipped_has_email",
      };
    }

    try {
      let organic: SerperOrganicResult[] = [];
      if (this.serper.isConfigured()) {
        organic = await this.serper.searchMany(queries);
      }

      const urlsToFetch = rankOfficialUrls(
        organic.map((r) => r.link),
        2
      );
      const fetchedPages = await fetchPages(urlsToFetch, 2);

      const snippetBlocks = this.buildSnippetBlocks(organic, fetchedPages);
      const allText = [
        ...organic.map((r) => `${r.title} ${r.snippet}`),
        ...fetchedPages.map((p) => p.text),
      ].join("\n");

      const regexCandidates = this.rankRegexCandidates(
        extractEmailsFromText(allText),
        physician,
        research
      );

      const extraction = await this.openai.extractProfessionalEmail({
        first_name: physician.first_name,
        last_name: physician.last_name,
        specialty: physician.specialty,
        organization: research?.current_employer ?? physician.organization,
        city: physician.city,
        state: physician.state,
        npi: physician.npi,
        website: physician.website,
        searchSnippets: snippetBlocks,
        regexCandidates,
      });

      const enrichmentMeta = {
        confidence: extraction.confidence,
        source_url: extraction.source_url,
        evidence: extraction.evidence,
        search_query: searchQuery,
        search_queries: queries,
        pages_fetched: fetchedPages.map((p) => p.url),
        regex_candidates: regexCandidates,
        enriched_at: new Date().toISOString(),
      };

      if (
        extraction.email &&
        extraction.confidence !== "none" &&
        extraction.confidence !== "low"
      ) {
        await this.physicians.update(physician.id, {
          email: extraction.email,
          research_metadata: {
            ...(physician.research_metadata ?? {}),
            email_enrichment: { ...enrichmentMeta, ai_suggested: true },
          },
        });

        return {
          physician_id: physician.id,
          email: extraction.email,
          confidence: extraction.confidence,
          source_url: extraction.source_url,
          evidence: extraction.evidence,
          search_query: searchQuery,
          status: "found",
        };
      }

      await this.physicians.update(physician.id, {
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          email_enrichment: {
            ...enrichmentMeta,
            ai_suggested: false,
            evidence: extraction.evidence ?? "No public email found",
          },
        },
      });

      return {
        physician_id: physician.id,
        email: null,
        confidence: extraction.confidence,
        source_url: extraction.source_url,
        evidence: extraction.evidence,
        search_query: searchQuery,
        status: "not_found",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Email enrichment failed", { physicianId: physician.id, error: message });

      await this.physicians.update(physician.id, {
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          email_enrichment: {
            enriched_at: new Date().toISOString(),
            ai_suggested: false,
            error: message,
            search_query: searchQuery,
          },
        },
      });

      return {
        physician_id: physician.id,
        email: null,
        confidence: "none",
        source_url: null,
        evidence: null,
        search_query: searchQuery,
        status: "error",
        error: message,
      };
    }
  }

  async enrichBatch(options: EnrichBatchOptions = {}): Promise<EnrichBatchResult> {
    const limit = options.limit ?? EMAIL_BATCH_CHUNK;
    let targets: Physician[];

    if (options.physicianIds?.length) {
      targets = (
        await Promise.all(options.physicianIds.map((id) => this.physicians.findById(id)))
      ).filter((p): p is Physician => p !== null);
    } else {
      targets = await this.physicians.listMissingEmail(limit, options.discoveredSince, {
        overwrite: options.overwrite,
      });
    }

    const results: EmailEnrichmentResult[] = [];
    let found = 0;
    let not_found = 0;
    let skipped = 0;
    let errors = 0;

    for (const physician of targets) {
      const result = await this.enrichPhysician(physician, {
        overwrite: options.overwrite,
      });
      results.push(result);
      if (result.status === "found") found++;
      else if (result.status === "not_found") not_found++;
      else if (result.status === "skipped_has_email") skipped++;
      else if (result.status === "error") errors++;

      await sleep(350);
    }

    const remaining = await this.physicians.countMissingEmail(options.discoveredSince, {
      overwrite: options.overwrite,
    });

    if (results.length === 0 && remaining > 0) {
      logger.warn("Email enrichment batch had no targets despite remaining leads", {
        remaining,
      });
    }

    logger.info("Email enrichment batch complete", {
      processed: results.length,
      found,
      not_found,
      remaining,
    });

    return {
      processed: results.length,
      found,
      not_found,
      skipped,
      errors,
      remaining,
      has_more: remaining > 0 && results.length > 0,
      results,
    };
  }
}
