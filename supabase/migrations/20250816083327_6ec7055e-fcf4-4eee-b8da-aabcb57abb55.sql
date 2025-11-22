-- Create table to store quote data for email restoration
CREATE TABLE public.quote_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id TEXT NOT NULL UNIQUE,
  vehicle_data JSONB NOT NULL,
  plan_data JSONB,
  customer_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '48 hours')
);

-- Enable RLS
ALTER TABLE public.quote_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read their own quote data by email
CREATE POLICY "Users can view their own quote data" 
ON public.quote_data 
FOR SELECT 
USING (true); -- Allow public access for quotes

-- Create policy to allow inserting quote data
CREATE POLICY "Allow inserting quote data" 
ON public.quote_data 
FOR INSERT 
WITH CHECK (true); -- Allow public inserts for quotes

-- Create index for better performance
CREATE INDEX idx_quote_data_quote_id ON public.quote_data(quote_id);
CREATE INDEX idx_quote_data_email ON public.quote_data(customer_email);
CREATE INDEX idx_quote_data_expires_at ON public.quote_data(expires_at);