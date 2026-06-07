-- CardioLocums AI Seed Data
-- Default scoring weights

INSERT INTO scoring_weights (factor_key, label, weight, description) VALUES
  ('retirement_proximity', 'Retirement Proximity', 20, 'Physician likely nearing retirement based on years in practice'),
  ('job_transition', 'Job Transition', 30, 'Recent employer or practice change detected'),
  ('active_publications', 'Active Publications', 10, 'Recent peer-reviewed or clinical publications'),
  ('conference_participation', 'Conference Participation', 10, 'Speaking or attendance at cardiology conferences'),
  ('new_organization', 'New Organization', 20, 'Recently joined a new hospital or practice group'),
  ('private_practice', 'Private Practice', 10, 'Independent or private practice setting'),
  ('prior_locums_indicators', 'Prior Locums Indicators', 40, 'Historical signals of locum or per-diem work')
ON CONFLICT (factor_key) DO NOTHING;

-- Sample physicians (demo data — no real PII)
INSERT INTO physicians (
  npi, first_name, last_name, specialty, subspecialty, city, state,
  organization, years_in_practice, source, lead_score, status,
  physician_summary, scoring_factors
) VALUES
(
  '1234567890',
  'James',
  'Mitchell',
  'Cardiology',
  'Interventional Cardiology',
  'Tampa',
  'FL',
  'Bay Heart Institute',
  22,
  'npi_registry',
  72,
  'qualified',
  'Interventional cardiologist in Tampa with 22 years experience. Affiliated with Bay Heart Institute. Published research in structural heart interventions. Active conference speaker.',
  '{"retirement_proximity": true, "active_publications": true, "conference_participation": true}'::jsonb
),
(
  '1234567891',
  'Sarah',
  'Chen',
  'Cardiology',
  'Electrophysiology',
  'Phoenix',
  'AZ',
  'Desert Cardiovascular Group',
  15,
  'cms_physician_compare',
  58,
  'researching',
  'Electrophysiology specialist in Phoenix. Mid-career physician at growing private practice. Recent job transition noted.',
  '{"job_transition": true, "private_practice": true}'::jsonb
),
(
  '1234567892',
  'Robert',
  'Williams',
  'Cardiology',
  'General Cardiology',
  'Charlotte',
  'NC',
  'Carolinas Medical Center',
  31,
  'hospital_directory',
  85,
  'contacted',
  'Senior general cardiologist with 31 years experience. Hospital-employed. Strong locums history indicators. Approaching retirement window.',
  '{"retirement_proximity": true, "prior_locums_indicators": true}'::jsonb
),
(
  '1234567893',
  'Emily',
  'Rodriguez',
  'Cardiology',
  'Heart Failure',
  'Houston',
  'TX',
  'Texas Heart Collaborative',
  8,
  'npi_registry',
  45,
  'new_lead',
  'Heart failure specialist early in career. Recently joined Texas Heart Collaborative.',
  '{"new_organization": true}'::jsonb
),
(
  '1234567894',
  'Michael',
  'Patel',
  'Cardiology',
  'Interventional Cardiology',
  'Denver',
  'CO',
  'Rocky Mountain Cardiology',
  18,
  'group_practice_website',
  63,
  'interested',
  'Interventional cardiologist in Denver. Private practice setting. Moderate publication activity.',
  '{"private_practice": true, "active_publications": true}'::jsonb
);

INSERT INTO physician_research (physician_id, current_employer, practice_size, hospital_affiliations, publications, conference_participation)
SELECT
  p.id,
  p.organization,
  CASE p.id
    WHEN (SELECT id FROM physicians WHERE npi = '1234567890') THEN 'Large (50+)'
    ELSE 'Medium (10-49)'
  END,
  '["Regional Medical Center", "University Hospital"]'::jsonb,
  '[{"title": "TAVR outcomes in high-risk patients", "year": 2024}]'::jsonb,
  '[{"name": "ACC Annual Scientific Session", "year": 2024, "role": "Speaker"}]'::jsonb
FROM physicians p
WHERE p.npi = '1234567890';

INSERT INTO activities (physician_id, activity_type, title, description, completed_at)
SELECT p.id, 'note', 'Initial profile review', 'High lead score — prioritize outreach', NOW() - INTERVAL '2 days'
FROM physicians p WHERE p.npi = '1234567892';

INSERT INTO activities (physician_id, activity_type, title, description, completed_at)
SELECT p.id, 'email', 'Intro outreach drafted', 'Draft created — pending human approval', NOW() - INTERVAL '1 day'
FROM physicians p WHERE p.npi = '1234567892';

INSERT INTO follow_up_recommendations (physician_id, recommendation, priority, reasoning, suggested_action_date)
SELECT p.id, 'Call this physician', 'high', 'Lead score 85 with prior locums indicators and no call logged in 14 days', CURRENT_DATE
FROM physicians p WHERE p.npi = '1234567892';

INSERT INTO follow_up_recommendations (physician_id, recommendation, priority, reasoning, suggested_action_date)
SELECT p.id, 'Follow up in 7 days', 'medium', 'Research phase complete — schedule qualification call', CURRENT_DATE + 7
FROM physicians p WHERE p.npi = '1234567891';

-- Spam/inbox test physician (your email — safe to delete after testing)
INSERT INTO physicians (
  npi, first_name, last_name, specialty, subspecialty, city, state,
  organization, years_in_practice, email, source, lead_score, status,
  physician_summary, research_metadata, scoring_factors
) VALUES (
  'TEST9999001',
  'Matthew',
  'TestPhysician',
  'Cardiology',
  'Interventional Cardiology',
  'Tampa',
  'FL',
  'Bay Heart Institute',
  14,
  'mattf94856@gmail.com',
  'manual_test',
  78,
  'qualified',
  'Interventional cardiologist in Tampa with academic hospital affiliations. Active in regional TAVR programs. Prior locums experience noted.',
  '{"scoring_status": "complete"}'::jsonb,
  '{"prior_locums_indicators": true, "active_publications": true, "conference_participation": true}'::jsonb
)
ON CONFLICT (npi) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  lead_score = EXCLUDED.lead_score,
  physician_summary = EXCLUDED.physician_summary,
  updated_at = NOW();

INSERT INTO physician_research (physician_id, current_employer, practice_size, hospital_affiliations, publications, conference_participation)
SELECT
  p.id,
  'Bay Heart Institute',
  'Large (50+)',
  '["Tampa General Hospital", "Regional Medical Center"]'::jsonb,
  '[{"title": "Outcomes in structural heart interventions", "year": 2024}]'::jsonb,
  '[{"name": "ACC Annual Scientific Session", "year": 2024, "role": "Speaker"}]'::jsonb
FROM physicians p
WHERE p.npi = 'TEST9999001'
ON CONFLICT (physician_id) DO UPDATE SET
  current_employer = EXCLUDED.current_employer,
  hospital_affiliations = EXCLUDED.hospital_affiliations,
  researched_at = NOW();
