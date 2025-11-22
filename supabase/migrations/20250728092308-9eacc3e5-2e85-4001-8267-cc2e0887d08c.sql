-- Create a table to track warranty serial numbers
CREATE TABLE IF NOT EXISTS public.warranty_serials (
  id SERIAL PRIMARY KEY,
  last_serial INTEGER NOT NULL DEFAULT 400000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial record if table is empty
INSERT INTO public.warranty_serials (last_serial)
SELECT 400000
WHERE NOT EXISTS (SELECT 1 FROM public.warranty_serials);

-- Create function to get and increment the next warranty serial number
CREATE OR REPLACE FUNCTION public.get_next_warranty_serial()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_serial INTEGER;
BEGIN
  -- Get and increment the serial number atomically
  UPDATE public.warranty_serials 
  SET last_serial = last_serial + 1,
      updated_at = NOW()
  WHERE id = (SELECT id FROM public.warranty_serials ORDER BY id LIMIT 1)
  RETURNING last_serial INTO next_serial;
  
  -- If no record exists, create one and return the initial value
  IF next_serial IS NULL THEN
    INSERT INTO public.warranty_serials (last_serial) VALUES (400001)
    RETURNING last_serial INTO next_serial;
  END IF;
  
  RETURN next_serial;
END;
$$;

-- Enable RLS on warranty_serials table
ALTER TABLE public.warranty_serials ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for service role access only
CREATE POLICY "Service role can manage warranty serials" 
ON public.warranty_serials 
FOR ALL 
USING (true);