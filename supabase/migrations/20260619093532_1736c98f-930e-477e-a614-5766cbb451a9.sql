SELECT cron.unschedule('process-renewal-campaigns-daily');

UPDATE public.email_templates SET is_active = false WHERE id = 'bd183bd3-c335-41f1-8653-72045f406e0d';

UPDATE public.renewal_offers SET active = false WHERE active = true;