
CREATE OR REPLACE FUNCTION public.get_blog_page_analytics(
  _paths text[],
  _since_days integer DEFAULT 90
)
RETURNS TABLE (
  page_path text,
  views bigint,
  visitors bigint,
  google_ads_views bigint,
  facebook_ads_views bigint,
  direct_views bigint,
  organic_views bigint,
  cta_sessions bigint,
  top_referrer text,
  top_utm_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => _since_days);
BEGIN
  RETURN QUERY
  WITH matched AS (
    SELECT pv.*
    FROM page_views pv
    WHERE pv.created_at >= _since
      AND pv.page_path = ANY(_paths)
  ),
  cta AS (
    SELECT DISTINCT m.session_id
    FROM matched m
    JOIN page_views p2
      ON p2.session_id = m.session_id
     AND p2.created_at >= m.created_at
     AND p2.created_at <= m.created_at + interval '2 hours'
     AND (p2.page_path ILIKE '/warranty-plan%'
          OR p2.page_path ILIKE '/checkout%'
          OR p2.page_path ILIKE '/cart%'
          OR p2.page_path ILIKE '%/quote%')
    WHERE m.session_id IS NOT NULL
  ),
  top_ref AS (
    SELECT DISTINCT ON (page_path)
      page_path, referrer, count(*) c
    FROM matched
    WHERE referrer IS NOT NULL AND referrer <> ''
    GROUP BY page_path, referrer
    ORDER BY page_path, c DESC
  ),
  top_utm AS (
    SELECT DISTINCT ON (page_path)
      page_path, utm_source, count(*) c
    FROM matched
    WHERE utm_source IS NOT NULL AND utm_source <> ''
    GROUP BY page_path, utm_source
    ORDER BY page_path, c DESC
  )
  SELECT
    m.page_path,
    count(*)::bigint AS views,
    count(DISTINCT m.visitor_id)::bigint AS visitors,
    count(*) FILTER (WHERE m.is_google_ads)::bigint AS google_ads_views,
    count(*) FILTER (WHERE m.is_facebook_ads)::bigint AS facebook_ads_views,
    count(*) FILTER (WHERE (m.referrer IS NULL OR m.referrer = '') AND m.utm_source IS NULL AND NOT coalesce(m.is_google_ads,false) AND NOT coalesce(m.is_facebook_ads,false))::bigint AS direct_views,
    count(*) FILTER (WHERE m.referrer ILIKE '%google.%' OR m.referrer ILIKE '%bing.%' OR m.referrer ILIKE '%duckduckgo.%' OR m.referrer ILIKE '%yahoo.%')::bigint AS organic_views,
    count(DISTINCT c.session_id)::bigint AS cta_sessions,
    max(tr.referrer) AS top_referrer,
    max(tu.utm_source) AS top_utm_source
  FROM matched m
  LEFT JOIN cta c ON c.session_id = m.session_id
  LEFT JOIN top_ref tr ON tr.page_path = m.page_path
  LEFT JOIN top_utm tu ON tu.page_path = m.page_path
  GROUP BY m.page_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_blog_page_analytics(text[], integer) TO authenticated, service_role;
