-- The live grid had every excess / claim-limit cell flattened to a single price,
-- so Step 3 showed no price change when customers changed an option.
-- Rebuild it around the same anchor prices (£399 / £659 / £938 at £150 excess,
-- middle claim-limit column) with proper excess and claim-limit steps.
WITH anchors AS (
  SELECT * FROM (VALUES ('12months', 399.0), ('24months', 659.0), ('36months', 938.0)) AS t(period, anchor)
), ex AS (
  SELECT * FROM (VALUES ('0', 1.28), ('50', 1.18), ('100', 1.08), ('150', 1.0), ('250', 0.81), ('500', 0.5)) AS t(excess, mult)
), cols AS (
  SELECT * FROM (VALUES ('750', 0.89), ('1250', 1.0), ('2000', 1.13)) AS t(col, mult)
), cells AS (
  SELECT a.period, e.excess, jsonb_object_agg(c.col, round(a.anchor * e.mult * c.mult)::int) AS cols
  FROM anchors a CROSS JOIN ex e CROSS JOIN cols c
  GROUP BY a.period, e.excess
), periods AS (
  SELECT period, jsonb_object_agg(excess, cols) AS grid FROM cells GROUP BY period
), matrix AS (
  SELECT jsonb_object_agg(period, grid) AS m FROM periods
)
UPDATE pricing_matrix_versions v
SET admin_matrix = matrix.m,
    updated_at = now()
FROM matrix
WHERE v.status = 'live';