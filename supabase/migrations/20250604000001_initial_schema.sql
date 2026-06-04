-- CardioLocums AI - Initial Schema
-- Run via Supabase CLI: supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE physician_status AS ENUM (
  'new_lead',
  'researching',
  'qualified',
  'contacted',
  'interested',
  'credentialing',
  'presented',
  'placed',
  'archived'
);

CREATE TYPE activity_type AS ENUM (
  'email',
  'call',
  'note',
  'follow_up',
  'linkedin',
  'voicemail',
  'status_change',
  'discovery',
  'research',
  'outreach_draft'
);

CREATE TYPE outreach_channel AS ENUM ('email', 'linkedin', 'voicemail');
CREATE TYPE outreach_draft_status AS ENUM ('draft', 'approved', 'sent', 'discarded');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('recruiter', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead scoring weights (admin-editable)
CREATE TABLE scoring_weights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factor_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Physicians
CREATE TABLE physicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  npi TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'Cardiology',
  subspecialty TEXT,
  city TEXT,
  state TEXT,
  organization TEXT,
  years_in_practice INTEGER,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  website TEXT,
  source TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  status physician_status NOT NULL DEFAULT 'new_lead',
  physician_summary TEXT,
  research_metadata JSONB DEFAULT '{}'::jsonb,
  scoring_factors JSONB DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES profiles(id),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Discovery job runs
CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_found INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_by UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Physician enrichment / research cache
CREATE TABLE physician_research (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  physician_id UUID NOT NULL REFERENCES physicians(id) ON DELETE CASCADE,
  current_employer TEXT,
  practice_size TEXT,
  hospital_affiliations JSONB DEFAULT '[]'::jsonb,
  publications JSONB DEFAULT '[]'::jsonb,
  speaking_appearances JSONB DEFAULT '[]'::jsonb,
  conference_participation JSONB DEFAULT '[]'::jsonb,
  raw_sources JSONB DEFAULT '{}'::jsonb,
  researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (physician_id)
);

-- Outreach drafts (human review required)
CREATE TABLE outreach_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  physician_id UUID NOT NULL REFERENCES physicians(id) ON DELETE CASCADE,
  channel outreach_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status outreach_draft_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  personalization_context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity timeline
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  physician_id UUID NOT NULL REFERENCES physicians(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Follow-up recommendations
CREATE TABLE follow_up_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  physician_id UUID NOT NULL REFERENCES physicians(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  reasoning TEXT,
  suggested_action_date DATE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard metrics cache (optional, updated by triggers/cron)
CREATE TABLE dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook events (n8n compatible)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_physicians_npi ON physicians(npi);
CREATE INDEX idx_physicians_status ON physicians(status);
CREATE INDEX idx_physicians_lead_score ON physicians(lead_score DESC);
CREATE INDEX idx_physicians_state ON physicians(state);
CREATE INDEX idx_physicians_specialty ON physicians(specialty);
CREATE INDEX idx_physicians_assigned ON physicians(assigned_to);
CREATE INDEX idx_physicians_name_trgm ON physicians USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX idx_physicians_org_trgm ON physicians USING gin (organization gin_trgm_ops);
CREATE INDEX idx_activities_physician ON activities(physician_id, created_at DESC);
CREATE INDEX idx_outreach_physician ON outreach_drafts(physician_id);
CREATE INDEX idx_follow_up_physician ON follow_up_recommendations(physician_id) WHERE NOT dismissed;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER physicians_updated_at
  BEFORE UPDATE ON physicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scoring_weights_updated_at
  BEFORE UPDATE ON scoring_weights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER outreach_drafts_updated_at
  BEFORE UPDATE ON outreach_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup (see also 20250605000001_fix_signup_profile.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE physicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE physician_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper: is authenticated
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());
CREATE POLICY profiles_insert_own ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert_service ON profiles FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Physicians: authenticated recruiters can CRUD
CREATE POLICY physicians_select ON physicians FOR SELECT TO authenticated
  USING (is_authenticated());
CREATE POLICY physicians_insert ON physicians FOR INSERT TO authenticated
  WITH CHECK (is_authenticated());
CREATE POLICY physicians_update ON physicians FOR UPDATE TO authenticated
  USING (is_authenticated());
CREATE POLICY physicians_delete ON physicians FOR DELETE TO authenticated
  USING (is_admin());

-- Scoring weights: all read, admin write
CREATE POLICY scoring_weights_select ON scoring_weights FOR SELECT TO authenticated
  USING (is_authenticated());
CREATE POLICY scoring_weights_admin ON scoring_weights FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Discovery runs
CREATE POLICY discovery_runs_all ON discovery_runs FOR ALL TO authenticated
  USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Research
CREATE POLICY physician_research_all ON physician_research FOR ALL TO authenticated
  USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Outreach
CREATE POLICY outreach_drafts_all ON outreach_drafts FOR ALL TO authenticated
  USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Activities
CREATE POLICY activities_all ON activities FOR ALL TO authenticated
  USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Follow-ups
CREATE POLICY follow_up_all ON follow_up_recommendations FOR ALL TO authenticated
  USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Dashboard snapshots
CREATE POLICY dashboard_snapshots_select ON dashboard_snapshots FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR is_admin());

-- Webhooks: service role only (no client access via anon key)
CREATE POLICY webhook_events_deny ON webhook_events FOR ALL TO authenticated
  USING (false);
