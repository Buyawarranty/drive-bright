-- Unblock all currently blocked IPs to allow users to complete purchases
DELETE FROM public.blocked_ips WHERE blocked_until > now() OR blocked_until IS NULL;

-- Reset click fraud protection records to start fresh
DELETE FROM public.click_fraud_protection WHERE created_at > now() - INTERVAL '24 hours';