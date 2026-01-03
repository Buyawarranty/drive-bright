-- Create access_requests table for sales team access requests
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  reason TEXT NOT NULL,
  requested_role TEXT DEFAULT 'sales',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_access_requests_status ON public.access_requests(status);
CREATE INDEX idx_access_requests_email ON public.access_requests(email);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can submit an access request (public insert)
CREATE POLICY "Anyone can submit access requests"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can view access requests
CREATE POLICY "Admins can view access requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can update access requests (approve/reject)
CREATE POLICY "Admins can update access requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Service role can manage all access requests
CREATE POLICY "Service role can manage access requests"
ON public.access_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();