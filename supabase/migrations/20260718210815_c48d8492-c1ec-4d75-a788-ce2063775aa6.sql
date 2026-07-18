ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'no_answer';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'left_voicemail';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'wrong_number';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'callback_booked';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'bought_elsewhere';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'vehicle_sold';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'do_not_contact';