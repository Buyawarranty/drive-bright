-- Enable realtime for lead distribution settings and agent caps
-- so admin and sales lead dashboards stay in sync
ALTER PUBLICATION supabase_realtime ADD TABLE lead_distribution_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_distribution_caps;