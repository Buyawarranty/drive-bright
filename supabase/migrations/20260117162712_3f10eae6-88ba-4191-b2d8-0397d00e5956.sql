-- Add call count tracking to sales_leads table
ALTER TABLE public.sales_leads 
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;

-- Also add to abandoned_carts for consistency
ALTER TABLE public.abandoned_carts
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;

-- Add index for potential filtering/sorting by call count
CREATE INDEX IF NOT EXISTS idx_sales_leads_call_count ON public.sales_leads(call_count);

COMMENT ON COLUMN public.sales_leads.call_count IS 'Number of call attempts made to this lead';
COMMENT ON COLUMN public.abandoned_carts.call_count IS 'Number of call attempts made to this lead';