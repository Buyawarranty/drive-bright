-- Ensure all statuses used by the app are valid enum values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'urgent_callback';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'archived';