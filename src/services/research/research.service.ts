import { calculateLeadScore, inferScoringFactors } from "@/lib/scoring";
import { logger } from "@/lib/logger";
import type { IOpenAIService } from "@/services/openai/openai.service";
import type { PhysicianRepository } from "@/repositories/physician.repository";
import type { ScoringRepository } from "@/repositories/scoring.repository";
import { formatPhysicianName } from "@/lib/utils";

export class ResearchService {
  constructor(
    private readonly physicianRepo: PhysicianRepository,
    private readonly scoringRepo: ScoringRepository,
    private readonly openai: IOpenAIService
  ) {}

  async researchPhysician(physicianId: string) {
    const physician = await this.physicianRepo.findById(physicianId);
    if (!physician) throw new Error("Physician not found");

    const research = await this.openai.researchPhysician({
      physicianName: formatPhysicianName(physician.first_name, physician.last_name),
      specialty: physician.specialty,
      organization: physician.organization ?? undefined,
      city: physician.city ?? undefined,
      state: physician.state ?? undefined,
      publicContext: physician.physician_summary ?? undefined,
    });

    const weights = await this.scoringRepo.getWeights();
    const factors = {
      ...inferScoringFactors({
        years_in_practice: physician.years_in_practice,
        organization: physician.organization,
        research: {
          publications: research.publications,
          conference_participation: research.conference_participation,
          practice_size: research.practice_size,
        },
        metadata: research.inferred_factors,
      }),
      ...Object.fromEntries(
        Object.entries(research.inferred_factors).map(([k, v]) => [k, Boolean(v)])
      ),
    };

    const lead_score = calculateLeadScore(factors, weights);

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
    });

    logger.info("Physician research saved", { physicianId, lead_score });
    return updated;
  }
}
