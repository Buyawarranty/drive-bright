ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS cancellation_note text,
ADD COLUMN IF NOT EXISTS cancellation_note_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS cancellation_note_updated_by uuid;