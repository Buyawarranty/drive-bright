-- Create claims_submissions table to store form submissions
CREATE TABLE public.claims_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claims_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage claims submissions" 
ON public.claims_submissions 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage claims submissions" 
ON public.claims_submissions 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_claims_submissions_updated_at
BEFORE UPDATE ON public.claims_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();