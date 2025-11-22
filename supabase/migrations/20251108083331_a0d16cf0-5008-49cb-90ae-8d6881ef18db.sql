-- Create table for customer survey responses
CREATE TABLE IF NOT EXISTS public.customer_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_number TEXT NOT NULL,
  reasons_chosen TEXT[] NOT NULL,
  other_reason TEXT,
  ease_rating TEXT NOT NULL,
  ease_explanation TEXT,
  suggestions TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customer_surveys ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts (for survey submissions)
CREATE POLICY "Allow anonymous survey submissions" 
ON public.customer_surveys 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Create policy for service role to read all surveys (for admin dashboard)
CREATE POLICY "Service role can read all surveys" 
ON public.customer_surveys 
FOR SELECT 
TO service_role
USING (true);

-- Create index for faster lookups by policy number
CREATE INDEX idx_customer_surveys_policy_number ON public.customer_surveys(policy_number);

-- Create index for faster lookups by submission date
CREATE INDEX idx_customer_surveys_submitted_at ON public.customer_surveys(submitted_at DESC);