-- Add percentage column for weighted team routing per source
ALTER TABLE public.lead_team_source_rules
  ADD COLUMN IF NOT EXISTS percentage integer NOT NULL DEFAULT 0;

ALTER TABLE public.lead_team_source_rules
  DROP CONSTRAINT IF EXISTS lead_team_source_rules_percentage_check;
ALTER TABLE public.lead_team_source_rules
  ADD CONSTRAINT lead_team_source_rules_percentage_check
  CHECK (percentage >= 0 AND percentage <= 100);

-- Backfill: any rule currently allowed = true gets an even split across the
-- teams that share that source. Rules with allowed = false keep percentage = 0.
WITH allowed_counts AS (
  SELECT source, COUNT(*)::int AS n
  FROM public.lead_team_source_rules
  WHERE allowed = true
  GROUP BY source
)
UPDATE public.lead_team_source_rules r
SET percentage = GREATEST(1, (100 / ac.n))
FROM allowed_counts ac
WHERE r.source = ac.source
  AND r.allowed = true
  AND r.percentage = 0;

-- Keep allowed and percentage consistent so legacy reads still work:
-- whenever percentage changes, mirror it into allowed.
CREATE OR REPLACE FUNCTION public.sync_source_rule_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.allowed := (NEW.percentage > 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_source_rule_allowed ON public.lead_team_source_rules;
CREATE TRIGGER trg_sync_source_rule_allowed
  BEFORE INSERT OR UPDATE ON public.lead_team_source_rules
  FOR EACH ROW EXECUTE FUNCTION public.sync_source_rule_allowed();