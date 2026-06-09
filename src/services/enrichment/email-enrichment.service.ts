import { EMAIL_BATCH_CHUNK, EMAIL_BATCH_TIME_BUDGET_MS } from "@/lib/batch-config";
import {
  extractEmailsFromText,
  normalizeScrapedEmail,
  rankOfficialUrls,
  scoreEmailForPhysician,
} from "@/lib/email-extract";
import { inferEmployerDomains } from "@/lib/employer-domains";
import { tryRegexFastPath } from "@/lib/email-regex-fast-path";
import { logger } from "@/lib/logger";
import { sleep } from "@/lib/utils";
import type { IOpenAIService } from "@/services/openai/openai.service";
import type { ISerperService } from "@/services/serper/serper.service";
import type { SerperOrganicResult } from "@/services/serper/serper.service";
import {
  cleanSearchTerm,
  quotedSearchTerm,
} from "@/services/serper/serper.service";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { Physician } from "@/types";
import type { EmailEnrichmentResult } from "@/services/enrichment/types";
import { fetchPages } from "@/services/enrichment/page-fetch.service";
import {
  buildFreeProfileSeedUrls,
  filterFetchableUrls,
  selectProfileUrlsToFetch,
  type EmailDiscoveryMethod,
} from "@/lib/public-profile-urls";
import {
  validateEmailDomain,
  validateHighConfidenceEmail,
} from "@/lib/email-validation";
import type { EmailExtractionOutput } from "@/services/enrichment/types";

const MANUAL_REVIEW_MIN_SCORE = Number.parseInt(
  process.env.EMAIL_MANUAL_REVIEW_MIN_SCORE ?? "60",
  10
);
const ENABLE_OPENAI_WEB_SEARCH = process.env.ENABLE_OPENAI_WEB_SEARCH === "true";

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

interface FetchedPage {
  url: string;
  text: string;
}

interface EnrichmentMeta {
  confidence: string;
  source_url: string | null;
  evidence: string | null;
  search_query: string;
  search_queries: string[];
  pages_fetched: string[];
  regex_candidates: string[];
  discovery_method: EmailDiscoveryMethod;
  serper_credits_exhausted: boolean;
  enriched_at: string;
  manual_review_recommended?: boolean;
  manual_review_reason?: string;
  suggested_profile_urls?: string[];
  ai_suggested?: boolean;
  rejected_reason?: string;
  verified_in_sources?: boolean;
  raw_email?: string;
  error?: string;
}

export class EmailEnrichmentService {
  constructor(
    private readonly physicians: PhysicianRepository,
    private readonly openai: IOpenAIService,
    private readonly serper: ISerperService
  ) {}

  /** Site-scoped Serper queries — used only after free sources miss. */
  buildSiteScopedSerperQueries(
    physician: Physician,
    research?: ResearchContext | null
  ): string[] {
    const first = cleanSearchTerm(physician.first_name);
    const last = cleanSearchTerm(physician.last_name);
    const name = quotedSearchTerm(`${first} ${last}`.trim());

    const orgs = [
      research?.current_employer?.trim(),
      physician.organization?.trim(),
      ...(research?.hospital_affiliations ?? []),
    ].filter((v): v is string => Boolean(v));

    const domains = inferEmployerDomains(orgs);
    const queries: string[] = [];

    for (const domain of domains.slice(0, 3)) {
      if (name) {
        queries.push(`site:${domain} ${name} cardiologist`);
        queries.push(`site:${domain} ${name} physician email`);
      }
      if (physician.npi && last) {
        queries.push(`site:${domain} NPI ${physician.npi} ${quotedSearchTerm(last)}`);
      }
    }

    return [...new Set(queries.filter((q) => q.length >= 8 && /site:[a-z0-9.-]+\s/i.test(q)))].slice(
      0,
      3
    );
  }

  private buildSnippetBlocks(
    organic: SerperOrganicResult[],
    pageTexts: FetchedPage[]
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

  private mergeFetchedPages(existing: FetchedPage[], incoming: FetchedPage[]): FetchedPage[] {
    const byUrl = new Map<string, FetchedPage>();
    for (const page of [...existing, ...incoming]) {
      if (page.text.trim()) byUrl.set(page.url, page);
    }
    return [...byUrl.values()];
  }

  private buildOrganizations(
    physician: Physician,
    research?: ResearchContext | null
  ): string[] {
    return [
      physician.organization,
      research?.current_employer,
      ...(research?.hospital_affiliations ?? []),
    ].filter((v): v is string => Boolean(v?.trim()));
  }

  private async extractFromPages(
    physician: Physician,
    research: ResearchContext | null,
    organic: SerperOrganicResult[],
    fetchedPages: FetchedPage[]
  ): Promise<{
    extraction: EmailExtractionOutput;
    regexCandidates: string[];
  }> {
    const orgs = this.buildOrganizations(physician, research);
    const allText = [
      ...organic.map((r) => `${r.title} ${r.snippet}`),
      ...fetchedPages.map((p) => p.text),
    ].join("\n");

    const regexCandidates = this.rankRegexCandidates(
      extractEmailsFromText(allText),
      physician,
      research
    );

    const fastPath = tryRegexFastPath({
      fetchedPages,
      firstName: physician.first_name,
      lastName: physician.last_name,
      organizations: orgs,
    });

    if (fastPath?.email) {
      return { extraction: fastPath, regexCandidates };
    }

    const extraction = await this.openai.extractProfessionalEmail({
      first_name: physician.first_name,
      last_name: physician.last_name,
      specialty: physician.specialty,
      organization: research?.current_employer ?? physician.organization,
      city: physician.city,
      state: physician.state,
      npi: physician.npi,
      website: physician.website,
      searchSnippets: this.buildSnippetBlocks(organic, fetchedPages),
      regexCandidates,
    });

    return { extraction, regexCandidates };
  }

  private manualReviewFields(
    physician: Physician,
    suggestedUrls: string[]
  ): Pick<EnrichmentMeta, "manual_review_recommended" | "manual_review_reason" | "suggested_profile_urls"> {
    if (physician.lead_score < MANUAL_REVIEW_MIN_SCORE) return {};

    return {
      manual_review_recommended: true,
      manual_review_reason: `High-score lead (${physician.lead_score}) — verify hospital profile page manually`,
      suggested_profile_urls: suggestedUrls.slice(0, 8),
    };
  }

  private async persistExtraction(
    physician: Physician,
    extraction: EmailExtractionOutput,
    enrichmentMeta: EnrichmentMeta,
    sourceTexts: string[],
    orgs: string[],
    searchQuery: string
  ): Promise<EmailEnrichmentResult> {
    const cleanedEmail = extraction.email ? normalizeScrapedEmail(extraction.email) : null;

    if (cleanedEmail && extraction.confidence === "high") {
      if (extraction.email && cleanedEmail !== extraction.email.trim().toLowerCase()) {
        enrichmentMeta.evidence = [
          extraction.evidence,
          `Normalized scraped email: ${extraction.email} → ${cleanedEmail}`,
        ]
          .filter(Boolean)
          .join(" | ");
      }

      const duplicate = await this.physicians.findOtherByEmail(cleanedEmail, physician.id);
      if (duplicate) {
        await this.physicians.update(physician.id, {
          research_metadata: {
            ...(physician.research_metadata ?? {}),
            email_enrichment: {
              ...enrichmentMeta,
              ai_suggested: false,
              rejected_reason: "duplicate_shared_inbox",
              evidence: `Rejected: email already assigned to Dr. ${duplicate.last_name}`,
            },
          },
        });

        return {
          physician_id: physician.id,
          email: null,
          confidence: extraction.confidence,
          source_url: extraction.source_url,
          evidence: "Shared inbox — same email on another physician",
          search_query: searchQuery,
          status: "not_found",
        };
      }

      const qualityCheck = validateHighConfidenceEmail({
        email: cleanedEmail,
        sourceUrl: extraction.source_url,
        sourceTexts,
        organizations: orgs,
        firstName: physician.first_name,
        lastName: physician.last_name,
      });

      if (!qualityCheck.ok) {
        await this.physicians.update(physician.id, {
          research_metadata: {
            ...(physician.research_metadata ?? {}),
            email_enrichment: {
              ...enrichmentMeta,
              ai_suggested: false,
              rejected_reason: qualityCheck.reason,
              evidence: `Rejected high-confidence email: ${qualityCheck.reason}`,
            },
          },
        });

        return {
          physician_id: physician.id,
          email: null,
          confidence: extraction.confidence,
          source_url: extraction.source_url,
          evidence: `High confidence rejected: ${qualityCheck.reason}`,
          search_query: searchQuery,
          status: "not_found",
        };
      }

      const domainCheck = await validateEmailDomain(cleanedEmail);
      if (!domainCheck.valid) {
        await this.physicians.update(physician.id, {
          research_metadata: {
            ...(physician.research_metadata ?? {}),
            email_enrichment: {
              ...enrichmentMeta,
              ai_suggested: false,
              rejected_reason: domainCheck.reason,
              evidence: `Rejected: domain failed mail DNS check (${domainCheck.reason})`,
            },
          },
        });

        return {
          physician_id: physician.id,
          email: null,
          confidence: extraction.confidence,
          source_url: extraction.source_url,
          evidence: `Domain invalid: ${domainCheck.reason}`,
          search_query: searchQuery,
          status: "not_found",
        };
      }

      await this.physicians.update(physician.id, {
        email: cleanedEmail,
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          email_enrichment: {
            ...enrichmentMeta,
            ai_suggested: enrichmentMeta.discovery_method !== "free_sources",
            verified_in_sources: true,
            ...(extraction.email !== cleanedEmail ? { raw_email: extraction.email } : {}),
          },
          email_validation: {
            valid: true,
            domain: domainCheck.domain,
            checked_at: new Date().toISOString(),
          },
        },
      });

      return {
        physician_id: physician.id,
        email: cleanedEmail,
        confidence: extraction.confidence,
        source_url: extraction.source_url,
        evidence: enrichmentMeta.evidence ?? extraction.evidence,
        search_query: searchQuery,
        status: "found",
      };
    }

    if (extraction.email && extraction.confidence === "medium") {
      await this.physicians.update(physician.id, {
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          email_enrichment: {
            ...enrichmentMeta,
            ai_suggested: false,
            rejected_reason: "medium_confidence_not_saved",
            evidence: extraction.evidence ?? "Medium confidence — not auto-saved",
          },
        },
      });
    } else {
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
    }

    return {
      physician_id: physician.id,
      email: null,
      confidence: extraction.confidence,
      source_url: extraction.source_url,
      evidence: extraction.evidence,
      search_query: searchQuery,
      status: "not_found",
    };
  }

  async enrichPhysician(
    physician: Physician,
    options?: { overwrite?: boolean }
  ): Promise<EmailEnrichmentResult> {
    const research = (await this.physicians.getResearch(physician.id)) as ResearchContext | null;
    const siteQueries = this.buildSiteScopedSerperQueries(physician, research);
    const searchQuery = siteQueries[0] ?? "";

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

    const profileInput = {
      first_name: physician.first_name,
      last_name: physician.last_name,
      specialty: physician.specialty,
      organization: research?.current_employer ?? physician.organization,
      city: physician.city,
      state: physician.state,
      npi: physician.npi,
      website: physician.website,
      hospital_affiliations: research?.hospital_affiliations ?? [],
    };

    const freeSeedUrls = buildFreeProfileSeedUrls({
      npi: physician.npi,
      website: physician.website,
      organization: research?.current_employer ?? physician.organization,
      state: physician.state,
      first_name: physician.first_name,
      last_name: physician.last_name,
      hospital_affiliations: research?.hospital_affiliations ?? [],
    });

    const orgs = this.buildOrganizations(physician, research);

    try {
      let discoveryMethod: EmailDiscoveryMethod = "free_sources";
      let organic: SerperOrganicResult[] = [];
      let fetchedPages: FetchedPage[] = [];
      let regexCandidates: string[] = [];
      let extraction: EmailExtractionOutput = {
        email: null,
        confidence: "none",
        source_url: null,
        evidence: null,
      };

      // Phase 1 — free URL sources only (NPI, website, employer directories, optional state board)
      const freeUrlsToFetch = selectProfileUrlsToFetch(
        filterFetchableUrls(freeSeedUrls, 10),
        4
      );
      fetchedPages = await fetchPages(freeUrlsToFetch, 4);

      ({ extraction, regexCandidates } = await this.extractFromPages(
        physician,
        research,
        organic,
        fetchedPages
      ));

      const serperAvailable =
        this.serper.isConfigured() && !this.serper.isCreditsExhausted();

      // Phase 2 — paid Serper, site-scoped only, when free sources did not yield high confidence
      if (
        !(extraction.email && extraction.confidence === "high") &&
        serperAvailable &&
        siteQueries.length > 0
      ) {
        discoveryMethod = "serper_site_scoped";
        try {
          organic = await this.serper.searchMany(siteQueries);
        } catch (error) {
          logger.warn("Serper searchMany failed — continuing without web results", {
            physicianId: physician.id,
            error: error instanceof Error ? error.message : "unknown",
          });
        }

        const serperUrls = rankOfficialUrls(
          filterFetchableUrls(
            organic.map((r) => r.link),
            6
          ),
          3
        );
        const serperPages = await fetchPages(serperUrls, 3);
        fetchedPages = this.mergeFetchedPages(fetchedPages, serperPages);

        ({ extraction, regexCandidates } = await this.extractFromPages(
          physician,
          research,
          organic,
          fetchedPages
        ));
      }

      const useOpenAiFallback =
        !(extraction.email && extraction.confidence === "high") &&
        (!serperAvailable ||
          this.serper.isCreditsExhausted() ||
          (siteQueries.length === 0 && organic.length === 0));

      // Phase 3 — OpenAI URL discovery when Serper unavailable; web search optional
      if (useOpenAiFallback && !(extraction.email && extraction.confidence === "high")) {
        discoveryMethod = "openai_public";
        const discovered = await this.openai.discoverPublicProfileUrls(profileInput);
        const fallbackUrls = selectProfileUrlsToFetch(
          filterFetchableUrls([...discovered.urls], 6),
          3
        );
        const fallbackPages = await fetchPages(fallbackUrls, 3);
        fetchedPages = this.mergeFetchedPages(fetchedPages, fallbackPages);

        ({ extraction, regexCandidates } = await this.extractFromPages(
          physician,
          research,
          organic,
          fetchedPages
        ));

        if (
          !extraction.email &&
          ENABLE_OPENAI_WEB_SEARCH &&
          !(extraction.confidence === "high")
        ) {
          discoveryMethod = "openai_web_search";
          const webSearch = await this.openai.searchPublicDatabasesForEmail(profileInput);
          if (webSearch.email) {
            extraction = {
              ...webSearch,
              evidence: [webSearch.evidence, "Found via OpenAI public database search"]
                .filter(Boolean)
                .join(" | "),
            };
          }
        }
      }

      const enrichmentMeta: EnrichmentMeta = {
        confidence: extraction.confidence,
        source_url: extraction.source_url,
        evidence: extraction.evidence as string | null,
        search_query: searchQuery,
        search_queries: siteQueries,
        pages_fetched: fetchedPages.map((p) => p.url),
        regex_candidates: regexCandidates,
        discovery_method: discoveryMethod,
        serper_credits_exhausted: this.serper.isCreditsExhausted(),
        enriched_at: new Date().toISOString(),
        ...this.manualReviewFields(physician, freeSeedUrls),
      };

      const sourceTexts = [
        ...regexCandidates,
        ...fetchedPages.map((p) => p.text),
        ...organic.map((r) => `${r.title} ${r.snippet}`),
      ];

      return this.persistExtraction(
        physician,
        extraction,
        enrichmentMeta,
        sourceTexts,
        orgs,
        searchQuery
      );
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
            discovery_method: "free_sources",
            confidence: "none",
            source_url: null,
            evidence: null,
            search_queries: siteQueries,
            pages_fetched: [],
            regex_candidates: [],
            serper_credits_exhausted: this.serper.isCreditsExhausted(),
            ...this.manualReviewFields(physician, freeSeedUrls),
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
    const batchStart = Date.now();

    for (const physician of targets) {
      if (Date.now() - batchStart > EMAIL_BATCH_TIME_BUDGET_MS) {
        logger.warn("Email enrichment batch stopped early — Vercel time budget", {
          processed: results.length,
          budget_ms: EMAIL_BATCH_TIME_BUDGET_MS,
        });
        break;
      }

      const result = await this.enrichPhysician(physician, {
        overwrite: options.overwrite,
      });
      results.push(result);
      if (result.status === "found") found++;
      else if (result.status === "not_found") not_found++;
      else if (result.status === "skipped_has_email") skipped++;
      else if (result.status === "error") errors++;

      await sleep(200);
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
