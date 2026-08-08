UPDATE public.discount_codes SET usage_limit = NULL, updated_at = now() WHERE upper(code) = 'SAVE25GO';
DELETE FROM public.email_unsubscribes WHERE email = 'linktest+unsub@example.com';
DELETE FROM public.marketing_audience WHERE email = 'linktest+unsub@example.com';