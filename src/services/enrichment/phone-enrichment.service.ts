import { PHONE_BATCH_CHUNK, PHONE_BATCH_TIME_BUDGET_MS } from "@/lib/batch-config";
import { logger } from "@/lib/logger";
import {
  extractPhonesFromText,
  normalizeUsPhone,
  scorePhoneForPhysician,
} from "@/lib/phone-extract";
import { pickBestPhoneCandidate } from "@/lib/phone-validation";
import { sleep } from "@/lib/utils";
import {
  buildFreeProfileSeedUrls,
  filterFetchableUrls,
  selectProfileUrlsToFetch,
} from "@/lib/public-profile-urls";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { GoogleSheetsService } from "@/services/sheets/google-sheets.service";
import type { Physician } from "@/types";
import { fetchPages } from "@/services/enrichment/page-fetch.service";
import type { PhoneEnrichmentResult } from "@/services/enrichment/types";

const MANUAL_REVIEW_MIN_SCORE = Number.parseInt(
  process.env.EMAIL_MANUAL_REVIEW_MIN_SCORE ?? "60",
  10
);

export interface EnrichPhoneBatchOptions {
  limit?: number;
  discoveredSince?: string;
  physicianIds?: string[];
  overwrite?: boolean;
  syncSheets?: boolean;
}

export interface EnrichPhoneBatchResult {
  processed: number;
  found: number;
  upgraded: number;
  practice_only: number;
  not_found: number;
  skipped: number;
  errors: number;
  remaining: number;
  has_more: boolean;
  sheets_synced: number;
  results: PhoneEnrichmentResult[];
}

interface ResearchContext {
  current_employer?: string | null;
  hospital_affiliations?: string[];
}

interface PhoneEnrichmentMeta {
  confidence: "profile_listed" | "practice" | "none";
  source_url: string | null;
  evidence: string | null;
  discovery_method: "free_sources" | "npi_existing";
  pages_fetched: string[];
  enriched_at: string;
  manual_review_recommended?: boolean;
  manual_review_reason?: string;
  sheet_synced_at?: string | null;
  sheet_synced_phone?: string | null;
}

export class PhoneEnrichmentService {
  constructor(
    private readonly physicians: PhysicianRepository,
    private readonly sheets?: GoogleSheetsService
  ) {}

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

  async enrichPhysician(
    physician: Physician,
    options?: { overwrite?: boolean }
  ): Promise<PhoneEnrichmentResult> {
    const research = (await this.physicians.getResearch(physician.id)) as ResearchContext | null;
    const orgs = this.buildOrganizations(physician, research);

    const existingMeta = physician.research_metadata?.phone_enrichment as
      | { enriched_at?: string }
      | undefined;

    if (existingMeta?.enriched_at && !options?.overwrite) {
      return {
        physician_id: physician.id,
        phone: physician.phone,
        confidence: "practice",
        source_url: null,
        evidence: "Phone enrichment already completed",
        status: "skipped_already_enriched",
      };
    }

    try {
      const freeSeedUrls = buildFreeProfileSeedUrls({
        npi: physician.npi,
        website: physician.website,
        organization: research?.current_employer ?? physician.organization,
        state: physician.state,
        first_name: physician.first_name,
        last_name: physician.last_name,
        hospital_affiliations: research?.hospital_affiliations ?? [],
      });

      const urlsToFetch = selectProfileUrlsToFetch(
        filterFetchableUrls(freeSeedUrls, 10),
        4
      );
      const fetchedPages = await fetchPages(urlsToFetch, 4);

      const candidates = fetchedPages.flatMap((page) =>
        extractPhonesFromText(page.text).map((phone) => ({
          phone,
          sourceUrl: page.url,
          pageText: page.text,
          score: scorePhoneForPhysician(phone, page.text, {
            first_name: physician.first_name,
            last_name: physician.last_name,
            organizations: orgs,
          }),
        }))
      );

      const best = pickBestPhoneCandidate(candidates, {
        firstName: physician.first_name,
        lastName: physician.last_name,
        organizations: orgs,
        existingPhone: physician.phone,
      });

      const npiPhone = physician.phone ? normalizeUsPhone(physician.phone) : null;
      const savedPhone = best?.phone ?? npiPhone;
      const confidence: PhoneEnrichmentMeta["confidence"] = best
        ? "profile_listed"
        : npiPhone
          ? "practice"
          : "none";
      const discoveryMethod: PhoneEnrichmentMeta["discovery_method"] = best
        ? "free_sources"
        : npiPhone
          ? "npi_existing"
          : "free_sources";

      const enrichmentMeta: PhoneEnrichmentMeta = {
        confidence,
        source_url: best?.sourceUrl ?? null,
        evidence: best
          ? "Phone listed on physician profile page near doctor name"
          : npiPhone
            ? "NPI practice location phone on file"
            : "No public phone found on profile pages",
        discovery_method: discoveryMethod,
        pages_fetched: fetchedPages.map((p) => p.url),
        enriched_at: new Date().toISOString(),
      };

      if (!savedPhone && physician.lead_score >= MANUAL_REVIEW_MIN_SCORE) {
        enrichmentMeta.manual_review_recommended = true;
        enrichmentMeta.manual_review_reason =
          "High-score lead — call NPI practice line or check hospital profile manually";
      }

      const upgraded = Boolean(best?.phone && best.phone !== npiPhone);

      if (savedPhone) {
        await this.physicians.update(physician.id, {
          phone: savedPhone,
          research_metadata: {
            ...(physician.research_metadata ?? {}),
            phone_enrichment: {
              ...enrichmentMeta,
              profile_upgraded: upgraded,
            },
          },
        });

        return {
          physician_id: physician.id,
          phone: savedPhone,
          confidence,
          source_url: enrichmentMeta.source_url,
          evidence: enrichmentMeta.evidence,
          status: upgraded || !npiPhone ? "found" : "practice_only",
        };
      }

      await this.physicians.update(physician.id, {
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          phone_enrichment: enrichmentMeta,
        },
      });

      return {
        physician_id: physician.id,
        phone: null,
        confidence: "none",
        source_url: null,
        evidence: enrichmentMeta.evidence,
        status: "not_found",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Phone enrichment failed", { physicianId: physician.id, error: message });

      await this.physicians.update(physician.id, {
        research_metadata: {
          ...(physician.research_metadata ?? {}),
          phone_enrichment: {
            enriched_at: new Date().toISOString(),
            confidence: "none",
            source_url: null,
            evidence: null,
            discovery_method: "free_sources",
            pages_fetched: [],
            error: message,
          },
        },
      });

      return {
        physician_id: physician.id,
        phone: null,
        confidence: "none",
        source_url: null,
        evidence: null,
        status: "error",
        error: message,
      };
    }
  }

  async enrichBatch(options: EnrichPhoneBatchOptions = {}): Promise<EnrichPhoneBatchResult> {
    const limit = options.limit ?? PHONE_BATCH_CHUNK;
    let targets: Physician[];

    if (options.physicianIds?.length) {
      targets = (
        await Promise.all(options.physicianIds.map((id) => this.physicians.findById(id)))
      ).filter((p): p is Physician => p !== null);
    } else {
      targets = await this.physicians.listNeedsPhoneEnrichment(limit, options.discoveredSince, {
        overwrite: options.overwrite,
      });
    }

    const results: PhoneEnrichmentResult[] = [];
    let found = 0;
    let upgraded = 0;
    let practice_only = 0;
    let not_found = 0;
    let skipped = 0;
    let errors = 0;
    const batchStart = Date.now();

    for (const physician of targets) {
      if (Date.now() - batchStart > PHONE_BATCH_TIME_BUDGET_MS) {
        logger.warn("Phone enrichment batch stopped early — Vercel time budget", {
          processed: results.length,
          budget_ms: PHONE_BATCH_TIME_BUDGET_MS,
        });
        break;
      }

      const result = await this.enrichPhysician(physician, {
        overwrite: options.overwrite,
      });
      results.push(result);

      if (result.status === "found") found++;
      else if (result.status === "practice_only") practice_only++;
      else if (result.status === "not_found") not_found++;
      else if (result.status === "skipped_already_enriched") skipped++;
      else if (result.status === "error") errors++;
      if (result.status === "found" && result.confidence === "profile_listed") upgraded++;

      await sleep(150);
    }

    let sheets_synced = 0;
    if (options.syncSheets !== false && this.sheets?.isConfigured()) {
      sheets_synced = await this.sheets.syncUnsyncedPhysicians(this.physicians);
    }

    const remaining = await this.physicians.countNeedsPhoneEnrichment(options.discoveredSince, {
      overwrite: options.overwrite,
    });

    logger.info("Phone enrichment batch complete", {
      processed: results.length,
      found,
      upgraded,
      practice_only,
      remaining,
      sheets_synced,
    });

    return {
      processed: results.length,
      found,
      upgraded,
      practice_only,
      not_found,
      skipped,
      errors,
      remaining,
      has_more: remaining > 0 && results.length > 0,
      sheets_synced,
      results,
    };
  }
}
