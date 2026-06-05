export type PhysicianStatus =
  | "new_lead"
  | "researching"
  | "qualified"
  | "contacted"
  | "interested"
  | "credentialing"
  | "presented"
  | "placed"
  | "archived";

export type ActivityType =
  | "email"
  | "call"
  | "note"
  | "follow_up"
  | "linkedin"
  | "voicemail"
  | "status_change"
  | "discovery"
  | "research"
  | "outreach_draft";

export type OutreachChannel = "email" | "linkedin" | "voicemail";
export type OutreachDraftStatus = "draft" | "approved" | "sent" | "discarded";

export interface Physician {
  id: string;
  npi: string | null;
  first_name: string;
  last_name: string;
  specialty: string;
  subspecialty: string | null;
  city: string | null;
  state: string | null;
  organization: string | null;
  years_in_practice: number | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  source: string | null;
  lead_score: number;
  status: PhysicianStatus;
  physician_summary: string | null;
  research_metadata: Record<string, unknown>;
  scoring_factors: Record<string, boolean>;
  assigned_to: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysicianResearch {
  id: string;
  physician_id: string;
  current_employer: string | null;
  practice_size: string | null;
  hospital_affiliations: string[];
  publications: PublicationRecord[];
  speaking_appearances: SpeakingRecord[];
  conference_participation: ConferenceRecord[];
  raw_sources: Record<string, unknown>;
  researched_at: string;
}

export interface PublicationRecord {
  title: string;
  year?: number;
  journal?: string;
}

export interface SpeakingRecord {
  title: string;
  event?: string;
  year?: number;
}

export interface ConferenceRecord {
  name: string;
  year?: number;
  role?: string;
}

export interface ScoringWeight {
  id: string;
  factor_key: string;
  label: string;
  weight: number;
  description: string | null;
  is_active: boolean;
}

export interface Activity {
  id: string;
  physician_id: string;
  user_id: string | null;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface OutreachDraft {
  id: string;
  physician_id: string;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
  status: OutreachDraftStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface FollowUpRecommendation {
  id: string;
  physician_id: string;
  recommendation: string;
  priority: "low" | "medium" | "high";
  reasoning: string | null;
  suggested_action_date: string | null;
  dismissed: boolean;
  created_at: string;
}

export interface PhysicianFilters {
  specialty?: string;
  subspecialty?: string;
  state?: string;
  city?: string;
  minYears?: number;
  maxYears?: number;
  minScore?: number;
  maxScore?: number;
  organization?: string;
  status?: PhysicianStatus;
  keyword?: string;
  discoveredSince?: string;
  hasEmail?: boolean;
  page?: number;
  limit?: number;
}

export interface DashboardMetrics {
  newPhysiciansDiscovered: number;
  leadsScored: number;
  topOpportunities: Physician[];
  outreachSent: number;
  responsesReceived: number;
  pipelineByStage: { stage: string; count: number }[];
  discoveryTrend: { date: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
}

export interface NormalizedPhysicianInput {
  npi?: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  subspecialty?: string;
  city?: string;
  state?: string;
  organization?: string;
  years_in_practice?: number;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  website?: string;
  source: string;
}

export const PIPELINE_STAGES: { id: PhysicianStatus; label: string }[] = [
  { id: "new_lead", label: "New Lead" },
  { id: "researching", label: "Researching" },
  { id: "qualified", label: "Qualified" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "credentialing", label: "Credentialing" },
  { id: "presented", label: "Presented" },
  { id: "placed", label: "Placed" },
  { id: "archived", label: "Archived" },
];

export const SCORING_FACTOR_KEYS = [
  "retirement_proximity",
  "job_transition",
  "active_publications",
  "conference_participation",
  "new_organization",
  "private_practice",
  "prior_locums_indicators",
] as const;

export type ScoringFactorKey = (typeof SCORING_FACTOR_KEYS)[number];
