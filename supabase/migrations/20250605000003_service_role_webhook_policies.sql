-- Explicit service_role access for n8n webhook batch writes.
-- Service role normally bypasses RLS; these policies guard against stricter project settings.

CREATE POLICY physicians_service ON physicians
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY physician_research_service ON physician_research
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY webhook_events_service ON webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
