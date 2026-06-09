-- Preview: high-confidence enriched emails that look like shared/department inboxes
SELECT
  id,
  first_name,
  last_name,
  email,
  organization,
  split_part(lower(email), '@', 1) AS local_part,
  split_part(lower(email), '@', 2) AS domain,
  research_metadata->'email_enrichment'->>'confidence' AS confidence
FROM physicians
WHERE email IS NOT NULL
  AND email != ''
  AND (
    split_part(lower(email), '@', 1) IN (
      'info', 'contact', 'contactus', 'support', 'admin', 'webmaster',
      'noreply', 'no-reply', 'donotreply', 'help', 'sales', 'marketing',
      'office', 'appointments', 'appointment', 'scheduling', 'reception',
      'frontdesk', 'billing', 'hr', 'careers', 'jobs', 'media', 'press',
      'feedback', 'inquiry', 'inquiries', 'enquiries', 'general', 'team',
      'patients', 'patient', 'registration', 'fax', 'main', 'communications',
      'referrals', 'referral', 'voicemail', 'service', 'services', 'web',
      'online', 'portal', 'triage', 'callcenter', 'customerservice',
      'privacy', 'legal', 'abuse', 'postmaster', 'newsletter', 'subscribe',
      'doctor', 'doctors', 'physician', 'physicians', 'provider', 'providers',
      'staff', 'directory', 'reservations', 'reservation', 'phpp', 'php',
      'email', 'mail', 'yourname', 'name', 'username', 'user', 'test', 'demo',
      'example', 'sample', 'inbox', 'hello', 'mailroom', 'records'
    )
    OR split_part(lower(email), '@', 2) LIKE '%contactus%'
    OR split_part(lower(email), '@', 2) LIKE '%formspree%'
    OR split_part(lower(email), '@', 2) LIKE '%wufoo%'
    OR split_part(lower(email), '@', 2) LIKE '%typeform%'
    OR split_part(lower(email), '@', 1) LIKE 'phpp%'
    OR split_part(lower(email), '@', 1) LIKE 'php%'
    OR split_part(lower(email), '@', 1) LIKE 'dept-%'
    OR split_part(lower(email), '@', 1) LIKE 'department-%'
    OR split_part(lower(email), '@', 1) LIKE 'appointments%'
    OR split_part(lower(email), '@', 1) LIKE 'scheduling%'
  )
ORDER BY last_name;

-- Clear those generic inbox emails
UPDATE physicians
SET
  email = NULL,
  updated_at = NOW(),
  research_metadata = jsonb_set(
    COALESCE(research_metadata, '{}'::jsonb),
    '{email_enrichment,cleared_reason}',
    '"generic_inbox"'::jsonb,
    true
  )
WHERE email IS NOT NULL
  AND email != ''
  AND (
    split_part(lower(email), '@', 1) IN (
      'info', 'contact', 'contactus', 'support', 'admin', 'webmaster',
      'noreply', 'no-reply', 'donotreply', 'help', 'sales', 'marketing',
      'office', 'appointments', 'appointment', 'scheduling', 'reception',
      'frontdesk', 'billing', 'hr', 'careers', 'jobs', 'media', 'press',
      'feedback', 'inquiry', 'inquiries', 'enquiries', 'general', 'team',
      'patients', 'patient', 'registration', 'fax', 'main', 'communications',
      'referrals', 'referral', 'voicemail', 'service', 'services', 'web',
      'online', 'portal', 'triage', 'callcenter', 'customerservice',
      'privacy', 'legal', 'abuse', 'postmaster', 'newsletter', 'subscribe',
      'doctor', 'doctors', 'physician', 'physicians', 'provider', 'providers',
      'staff', 'directory', 'reservations', 'reservation', 'phpp', 'php',
      'email', 'mail', 'yourname', 'name', 'username', 'user', 'test', 'demo',
      'example', 'sample', 'inbox', 'hello', 'mailroom', 'records'
    )
    OR split_part(lower(email), '@', 2) LIKE '%contactus%'
    OR split_part(lower(email), '@', 2) LIKE '%formspree%'
    OR split_part(lower(email), '@', 2) LIKE '%wufoo%'
    OR split_part(lower(email), '@', 2) LIKE '%typeform%'
    OR split_part(lower(email), '@', 1) LIKE 'phpp%'
    OR split_part(lower(email), '@', 1) LIKE 'php%'
    OR split_part(lower(email), '@', 1) LIKE 'dept-%'
    OR split_part(lower(email), '@', 1) LIKE 'department-%'
    OR split_part(lower(email), '@', 1) LIKE 'appointments%'
    OR split_part(lower(email), '@', 1) LIKE 'scheduling%'
  );
