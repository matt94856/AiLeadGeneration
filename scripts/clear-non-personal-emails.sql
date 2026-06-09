-- Preview: enriched emails where physician name does NOT appear in the local part
SELECT
  id,
  first_name,
  last_name,
  email,
  organization,
  research_metadata->'email_enrichment'->>'confidence' AS confidence
FROM physicians
WHERE email IS NOT NULL
  AND email != ''
  AND lower(split_part(email, '@', 1)) NOT LIKE '%' || lower(last_name) || '%'
  AND lower(split_part(email, '@', 1)) NOT LIKE '%' || lower(first_name) || '%'
ORDER BY last_name;

-- Fix merged "Email" label prefix on otherwise valid addresses
UPDATE physicians
SET
  email = regexp_replace(lower(email), '^email(?=[a-z0-9])', ''),
  updated_at = NOW()
WHERE email IS NOT NULL
  AND lower(split_part(email, '@', 1)) LIKE 'email%'
  AND length(split_part(email, '@', 1)) > 8;

-- Clear non-personal / wrong-person emails (keeps kathleen.evans@, ayoub.chadi@, etc.)
UPDATE physicians
SET
  email = NULL,
  updated_at = NOW(),
  research_metadata = jsonb_set(
    COALESCE(research_metadata, '{}'::jsonb),
    '{email_enrichment,cleared_reason}',
    '"name_not_in_email"'::jsonb,
    true
  )
WHERE email IS NOT NULL
  AND email != ''
  AND lower(split_part(email, '@', 1)) NOT LIKE '%' || lower(last_name) || '%'
  AND lower(split_part(email, '@', 1)) NOT LIKE '%' || lower(first_name) || '%';

-- Clear duplicate emails used by multiple physicians (shared inbox)
WITH shared AS (
  SELECT lower(trim(email)) AS email_key
  FROM physicians
  WHERE email IS NOT NULL AND email != ''
  GROUP BY lower(trim(email))
  HAVING COUNT(*) > 1
)
UPDATE physicians p
SET
  email = NULL,
  updated_at = NOW(),
  research_metadata = jsonb_set(
    COALESCE(p.research_metadata, '{}'::jsonb),
    '{email_enrichment,cleared_reason}',
    '"duplicate_shared_inbox"'::jsonb,
    true
  )
FROM shared s
WHERE lower(trim(p.email)) = s.email_key;
