
-- Clean up existing duplicates before adding unique constraints
-- Keep the earliest record for each duplicate, mark others as deleted

-- Mark duplicate customers with bumper_order_id as deleted (keep earliest)
WITH duplicates AS (
  SELECT 
    id,
    bumper_order_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY bumper_order_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.customers
  WHERE bumper_order_id IS NOT NULL
    AND is_deleted = false
)
UPDATE public.customers c
SET 
  is_deleted = true,
  deleted_at = now(),
  deleted_by = NULL
FROM duplicates d
WHERE c.id = d.id 
  AND d.rn > 1;

-- Mark duplicate customers with stripe_session_id as deleted (keep earliest)
WITH duplicates AS (
  SELECT 
    id,
    stripe_session_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_session_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.customers
  WHERE stripe_session_id IS NOT NULL
    AND is_deleted = false
)
UPDATE public.customers c
SET 
  is_deleted = true,
  deleted_at = now(),
  deleted_by = NULL
FROM duplicates d
WHERE c.id = d.id 
  AND d.rn > 1;

-- Mark duplicate policies with bumper_order_id as deleted (keep earliest)
WITH duplicates AS (
  SELECT 
    id,
    bumper_order_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY bumper_order_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.customer_policies
  WHERE bumper_order_id IS NOT NULL
    AND is_deleted = false
)
UPDATE public.customer_policies p
SET 
  is_deleted = true,
  deleted_at = now(),
  deleted_by = NULL
FROM duplicates d
WHERE p.id = d.id 
  AND d.rn > 1;

-- Mark duplicate policies with stripe_session_id as deleted (keep earliest)
WITH duplicates AS (
  SELECT 
    id,
    stripe_session_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_session_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.customer_policies
  WHERE stripe_session_id IS NOT NULL
    AND is_deleted = false
)
UPDATE public.customer_policies p
SET 
  is_deleted = true,
  deleted_at = now(),
  deleted_by = NULL
FROM duplicates d
WHERE p.id = d.id 
  AND d.rn > 1;

-- Now add unique constraints (only on non-deleted records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_bumper_order_id_unique 
ON public.customers(bumper_order_id) 
WHERE bumper_order_id IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_stripe_session_id_unique 
ON public.customers(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_bumper_order_id_unique 
ON public.customer_policies(bumper_order_id) 
WHERE bumper_order_id IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_stripe_session_id_unique 
ON public.customer_policies(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL AND is_deleted = false;
