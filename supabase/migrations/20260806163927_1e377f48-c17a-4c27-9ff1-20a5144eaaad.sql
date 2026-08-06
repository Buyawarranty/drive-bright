UPDATE public.pricing_matrix_versions
SET status = 'archived', updated_at = now()
WHERE status = 'live';