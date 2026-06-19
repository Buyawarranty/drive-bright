UPDATE public.lead_teams
SET name = regexp_replace(name, '^Formula\s+', 'Team ', 'i')
WHERE name ILIKE 'Formula %';