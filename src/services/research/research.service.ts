import {
  inferScoringFactors,
  normalizeInferredFactors,
  resolveLeadScore,
} from "@/lib/scoring";
import { logger } from "@/lib/logger";
import { sleep } from "@/lib/utils";
import type { IOpenAIService } from "@/services/openai/openai.service";
import type { OpenAIResearchOutput } from "@/services/types";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { ScoringRepository } from "@/repositories/scoring.repository";
import { formatPhysicianName } from "@/lib/utils";
import type { Physician } from "@/types";

export interface ResearchBatchOptions {
  limit?: number;
  discoveredSince?: string;
  physicianIds?: string[];
}

export interface ResearchBatchResult {
  processed: number;
  completed: number;
  failed: number;
  results: Array<{ physician_id: string; lead_score?: number; status: "complete" | "failed"; error?: string }>;
}

export class ResearchService {
  constructor(
    private readonly physicianRepo: PhysicianRepository,
    private readonly scoringRepo: ScoringRepository,
    private readonly openai: IOpenAIService
  ) {}

  private buildFactors(physician: Physician, research: OpenAIResearchOutput) {
    return {
      ...inferScoringFactors({
        years_in_practice: physician.years_in_practice,
        organization: research.current_employer ?? physician.organization,
        research: {
          publications: research.publications,
          conference_participation: research.conference_participation,
          practice_size: research.practice_size,
        },
        metadata: research.inferred_factors as Record<string, unknown> | undefined,
      }),
      ...normalizeInferredFactors(research.inferred_factors as Record<string, unknown> | undefined),
    };
  }

  private computeScore(
    physician: Physician,
    research: OpenAIResearchOutput,
    weights: Awaited<ReturnType<ScoringRepository["getWeights"]>>
  ) {
    const factors = this.buildFactors(physician, research);
    let lead_score = resolveLeadScore(factors, weights, research.lead_score ?? null);

    if (lead_score === 0 && research.physician_summary) {
      lead_score = 20;
      if (research.publications?.length) lead_score += 10;
      if (research.conference_participation?.length) lead_score += 10;
      if (research.inferred_factors?.prior_locums_indicators) lead_score += 15;
      lead_score = Math.min(lead_score, 100);
    }

    return { factors, lead_score };
  }

  async researchPhysician(physicianId: string) {
    const physician = await this.physicianRepo.findById(physicianId);
    if (!physician) throw new Error("Physician not found");

    await this.physicianRepo.update(physicianId, {
      research_metadata: {
        ...physician.research_metadata,
        scoring_status: "processing",
      },
    });

    const research = await this.openai.researchPhysician({
      physicianName: formatPhysicianName(physician.first_name, physician.last_name),
      specialty: physician.specialty,
      organization: physician.organization ?? undefined,
      city: physician.city ?? undefined,
      state: physician.state ?? undefined,
      publicContext: physician.physician_summary ?? undefined,
    });

    const weights = await this.scoringRepo.getWeights();
    const { factors, lead_score } = this.computeScore(physician, research, weights);

    await this.physicianRepo.saveResearch(physicianId, {
      current_employer: research.current_employer ?? physician.organization,
      practice_size: research.practice_size,
      hospital_affiliations: research.hospital_affiliations,
      publications: research.publications,
      speaking_appearances: research.speaking_appearances,
      conference_participation: research.conference_participation,
      raw_sources: { ai: true },
    });

    const updated = await this.physicianRepo.update(physicianId, {
      physician_summary: research.physician_summary,
      lead_score,
      scoring_factors: factors as Record<string, boolean>,
      status: physician.status === "new_lead" ? "researching" : physician.status,
      research_metadata: {
        ...physician.research_metadata,
        scoring_status: "complete",
        scored_at: new Date().toISOString(),
      },
    });

    logger.info("Physician research saved", { physicianId, lead_score });
    return updated;
  }

  async researchBatch(options: ResearchBatchOptions = {}): Promise<ResearchBatchResult> {
    const limit = options.limit ?? 25;
    let targets: Physician[];

    if (options.physicianIds?.length) {
      targets = (
        await Promise.all(options.physicianIds.map((id) => this.physicianRepo.findById(id)))
      ).filter((p): p is Physician => {
        if (!p) return false;
        const status = p.research_metadata?.scoring_status;
        if (status === "processing") return false;
        if (status === "complete" && p.lead_score > 0) return false;
        return true;
      });
    } else {
      targets = await this.physicianRepo.listNeedsScoring(limit, options.discoveredSince);
    }

    const results: ResearchBatchResult["results"] = [];
    let completed = 0;
    let failed = 0;

    for (const physician of targets.slice(0, limit)) {
      try {
        const updated = await this.researchPhysician(physician.id);
        completed++;
        results.push({
          physician_id: physician.id,
          lead_score: updated.lead_score,
          status: "complete",
        });
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "unknown";
        await this.physicianRepo.update(physician.id, {
          research_metadata: {
            ...physician.research_metadata,
            scoring_status: "failed",
            scoring_error: message,
          },
        });
        results.push({
          physician_id: physician.id,
          status: "failed",
          error: message,
        });
        logger.warn("Physician research failed", { physicianId: physician.id, error: message });
      }

      await sleep(400);
    }

    logger.info("Research batch complete", { processed: results.length, completed, failed });
    return { processed: results.length, completed, failed, results };
  }
}
