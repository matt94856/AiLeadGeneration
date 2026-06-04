import { logger } from "@/lib/logger";
import { sleep } from "@/lib/utils";
import type { IOpenAIService } from "@/services/openai/openai.service";
import type { ISerperService } from "@/services/serper/serper.service";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { Physician } from "@/types";
import type { EmailEnrichmentResult } from "@/services/enrichment/types";

export interface EnrichBatchOptions {
  limit?: number;
  discoveredSince?: string;
  physicianIds?: string[];
  minConfidence?: "medium" | "high";
  overwrite?: boolean;
}

export class EmailEnrichmentService {
  constructor(
    private readonly physicians: PhysicianRepository,
    private readonly openai: IOpenAIService,
    private readonly serper: ISerperService
  ) {}

  buildSearchQuery(physician: Physician): string {
    const parts = [
      "Dr",
      physician.first_name,
      physician.last_name,
      physician.subspecialty ?? physician.specialty,
      physician.organization,
      physician.city,
      physician.state,
      "email contact",
    ].filter(Boolean);
    return parts.join(" ");
  }

  async enrichPhysician(
    physician: Physician,
    options?: { overwrite?: boolean }
  ): Promise<EmailEnrichmentResult> {
    const searchQuery = this.buildSearchQuery(physician);

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
      let snippets: string[] = [];
      if (this.serper.isConfigured()) {
        const search = await this.serper.search(searchQuery);
        snippets = search.organic.map(
          (r) => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
        );
      }

      const extraction = await this.openai.extractProfessionalEmail({
        first_name: physician.first_name,
        last_name: physician.last_name,
        specialty: physician.specialty,
        organization: physician.organization,
        city: physician.city,
        state: physician.state,
        npi: physician.npi,
        website: physician.website,
        searchSnippets: snippets,
      });

      if (
        extraction.email &&
        extraction.confidence !== "none" &&
        extraction.confidence !== "low"
      ) {
        const metadata = {
          ...(physician.research_metadata ?? {}),
          email_enrichment: {
            confidence: extraction.confidence,
            source_url: extraction.source_url,
            evidence: extraction.evidence,
            search_query: searchQuery,
            enriched_at: new Date().toISOString(),
            ai_suggested: true,
          },
        };

        await this.physicians.update(physician.id, {
          email: extraction.email,
          research_metadata: metadata,
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

      const metadata = {
        ...(physician.research_metadata ?? {}),
        email_enrichment: {
          confidence: extraction.confidence,
          evidence: extraction.evidence ?? "No public email found",
          search_query: searchQuery,
          enriched_at: new Date().toISOString(),
          ai_suggested: false,
        },
      };
      await this.physicians.update(physician.id, { research_metadata: metadata });

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

  async enrichBatch(options: EnrichBatchOptions = {}): Promise<{
    processed: number;
    found: number;
    not_found: number;
    skipped: number;
    errors: number;
    results: EmailEnrichmentResult[];
  }> {
    const limit = options.limit ?? 25;
    let targets: Physician[];

    if (options.physicianIds?.length) {
      targets = (
        await Promise.all(options.physicianIds.map((id) => this.physicians.findById(id)))
      ).filter((p): p is Physician => p !== null);
    } else {
      targets = await this.physicians.listMissingEmail(limit, options.discoveredSince);
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

      await sleep(400);
    }

    logger.info("Email enrichment batch complete", {
      processed: results.length,
      found,
      not_found,
    });

    return { processed: results.length, found, not_found, skipped, errors, results };
  }
}
