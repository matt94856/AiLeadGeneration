-- Preview: emails saved from enrichment where confidence was NOT high
SELECT
  id,
  first_name,
  last_name,
  email,
  organization,
  research_metadata->'email_enrichment'->>'confidence' AS confidence,
  research_metadata->'email_enrichment'->>'source_url' AS source_url,
  research_metadata->'email_enrichment'->>'enriched_at' AS enriched_at
FROM physicians
WHERE email IS NOT NULL
  AND email != ''
  AND research_metadata->'email_enrichment'->>'enriched_at' IS NOT NULL
  AND research_metadata->'email_enrichment'->>'confidence' IS DISTINCT FROM 'high'
ORDER BY enriched_at DESC;

-- Clear only non-high-confidence enriched emails (keeps enrichment metadata for audit)
UPDATE physicians
SET
  email = NULL,
  updated_at = NOW(),
  research_metadata = jsonb_set(
    COALESCE(research_metadata, '{}'::jsonb),
    '{email_enrichment,cleared_at}',
    to_jsonb(NOW()::text),
    true
  )
WHERE email IS NOT NULL
  AND email != ''
  AND research_metadata->'email_enrichment'->>'enriched_at' IS NOT NULL
  AND research_metadata->'email_enrichment'->>'confidence' IS DISTINCT FROM 'high';

-- Count remaining high-confidence enriched emails
SELECT COUNT(*) AS high_confidence_emails
FROM physicians
WHERE email IS NOT NULL
  AND email != ''
  AND research_metadata->'email_enrichment'->>'confidence' = 'high';
