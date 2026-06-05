import type { SupabaseClient } from "@supabase/supabase-js";
import { CmsService } from "@/services/cms/cms.service";
import {
  CmsPhysicianCompareAdapter,
  GroupPracticeAdapter,
  HospitalDirectoryAdapter,
  NpiRegistryAdapter,
  StateMedicalBoardAdapter,
} from "@/services/discovery/adapters";
import type { DataSourceAdapter } from "@/services/types";
import { DiscoveryService } from "@/services/discovery/discovery.service";
import { UsGrowthDiscoveryService } from "@/services/discovery/us-growth-discovery.service";
import { NpiService } from "@/services/npi/npi.service";
import { MockOpenAIService, OpenAIService } from "@/services/openai/openai.service";
import type { IOpenAIService } from "@/services/openai/openai.service";
import { ActivityRepository } from "@/repositories/activity.repository";
import { DashboardRepository } from "@/repositories/dashboard.repository";
import { OutreachRepository } from "@/repositories/outreach.repository";
import { PhysicianRepository } from "@/repositories/physician.repository";
import { ScoringRepository } from "@/repositories/scoring.repository";
import { DiscoveryProgressRepository } from "@/repositories/discovery-progress.repository";
import { ResearchService } from "@/services/research/research.service";
import { SerperService } from "@/services/serper/serper.service";
import { EmailEnrichmentService } from "@/services/enrichment/email-enrichment.service";

export interface ServiceContainer {
  physicians: PhysicianRepository;
  scoring: ScoringRepository;
  activities: ActivityRepository;
  outreach: OutreachRepository;
  dashboard: DashboardRepository;
  discovery: DiscoveryService;
  usGrowthDiscovery: UsGrowthDiscoveryService;
  research: ResearchService;
  emailEnrichment: EmailEnrichmentService;
  openai: IOpenAIService;
  npi: NpiService;
  cms: CmsService;
}

let cachedContainer: ServiceContainer | null = null;

export function createContainer(supabase: SupabaseClient): ServiceContainer {
  const npi = new NpiService();
  const cms = new CmsService();
  const openai = process.env.OPENAI_API_KEY
    ? new OpenAIService(process.env.OPENAI_API_KEY)
    : new MockOpenAIService();

  const adapters = new Map<string, DataSourceAdapter>([
    ["npi_registry", new NpiRegistryAdapter(npi)],
    ["cms_physician_compare", new CmsPhysicianCompareAdapter(cms)],
    ["state_medical_board", new StateMedicalBoardAdapter()],
    ["hospital_directory", new HospitalDirectoryAdapter()],
    ["group_practice_website", new GroupPracticeAdapter()],
  ]);

  const physicians = new PhysicianRepository(supabase);
  const scoring = new ScoringRepository(supabase);
  const activities = new ActivityRepository(supabase);
  const outreach = new OutreachRepository(supabase);
  const dashboard = new DashboardRepository(supabase);
  const serper = new SerperService();
  const discoveryProgress = new DiscoveryProgressRepository(supabase);

  return {
    physicians,
    scoring,
    activities,
    outreach,
    dashboard,
    discovery: new DiscoveryService(adapters, physicians),
    usGrowthDiscovery: new UsGrowthDiscoveryService(npi, physicians, discoveryProgress),
    research: new ResearchService(physicians, scoring, openai),
    emailEnrichment: new EmailEnrichmentService(physicians, openai, serper),
    openai,
    npi,
    cms,
  };
}

export function getContainer(supabase: SupabaseClient): ServiceContainer {
  if (!cachedContainer) {
    cachedContainer = createContainer(supabase);
  }
  return cachedContainer;
}

export function resetContainer(): void {
  cachedContainer = null;
}
