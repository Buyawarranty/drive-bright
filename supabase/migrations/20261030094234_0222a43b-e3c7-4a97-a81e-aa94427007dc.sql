ALTER FUNCTION public.get_social_analytics(timestamptz,timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.offline_campaign_monthly_stats(text[],date,date) SECURITY INVOKER;
ALTER FUNCTION public.postcode_area_monthly_sales(date,date) SECURITY INVOKER;
ALTER FUNCTION public.postcode_district_stats(date,date,text) SECURITY INVOKER;