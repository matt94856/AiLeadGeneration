-- Tracks US-wide NPI discovery cursor (state rotation + per-state skip pagination)

CREATE TABLE discovery_progress (
  key TEXT PRIMARY KEY,
  state_index INTEGER NOT NULL DEFAULT 0,
  state_skips JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_mode TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO discovery_progress (key, state_index, state_skips, last_mode)
VALUES ('npi_us', 0, '{}'::jsonb, 'new_leads')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE discovery_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY discovery_progress_service ON discovery_progress
  FOR ALL TO service_role USING (true) WITH CHECK (true);
