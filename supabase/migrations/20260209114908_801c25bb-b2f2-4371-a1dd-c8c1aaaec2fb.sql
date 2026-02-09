
-- Step 1: Add 'sales_lead' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sales_lead';
