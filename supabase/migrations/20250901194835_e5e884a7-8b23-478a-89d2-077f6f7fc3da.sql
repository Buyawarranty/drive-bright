-- Add unique constraint on registration column to enable upserts
ALTER TABLE public.mot_history ADD CONSTRAINT mot_history_registration_unique UNIQUE (registration);