-- Add the missing vehicle_type column to abandoned_carts table
ALTER TABLE public.abandoned_carts 
ADD COLUMN vehicle_type TEXT;