-- Add warranty reference column to customers table
ALTER TABLE public.customers ADD COLUMN warranty_reference_number text;