-- PERF: functional index for fast MOT lookup regardless of stored casing/spacing
CREATE INDEX IF NOT EXISTS idx_mot_history_reg_normalized
  ON public.mot_history (upper(replace(registration, ' ', '')));

-- PERF: reset stale query stats so dashboards reflect real-world post-fix perf
SELECT pg_stat_statements_reset();