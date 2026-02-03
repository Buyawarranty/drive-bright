-- Create marketing_audience table for unified mailing list
CREATE TABLE public.marketing_audience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID,
  reg_plate TEXT,
  mileage TEXT,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  source TEXT,
  source_type TEXT, -- 'sales_lead', 'abandoned_cart', 'manual'
  lead_status TEXT,
  is_subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  contact_count INTEGER DEFAULT 0,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint for deduplication
  CONSTRAINT unique_email_or_phone UNIQUE NULLS NOT DISTINCT (email, phone)
);

-- Create indexes for fast lookups
CREATE INDEX idx_marketing_audience_email ON public.marketing_audience(email) WHERE email IS NOT NULL;
CREATE INDEX idx_marketing_audience_phone ON public.marketing_audience(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_marketing_audience_source_type ON public.marketing_audience(source_type);
CREATE INDEX idx_marketing_audience_is_subscribed ON public.marketing_audience(is_subscribed);
CREATE INDEX idx_marketing_audience_created_at ON public.marketing_audience(created_at DESC);
CREATE INDEX idx_marketing_audience_lead_id ON public.marketing_audience(lead_id);

-- Enable RLS
ALTER TABLE public.marketing_audience ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view marketing audience"
ON public.marketing_audience FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Admins can insert marketing audience"
ON public.marketing_audience FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Admins can update marketing audience"
ON public.marketing_audience FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Admins can delete marketing audience"
ON public.marketing_audience FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

-- Create sync log table
CREATE TABLE public.marketing_audience_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'auto', 'manual'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  leads_processed INTEGER DEFAULT 0,
  leads_added INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'running' -- 'running', 'completed', 'failed'
);

-- RLS for sync log
ALTER TABLE public.marketing_audience_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync log"
ON public.marketing_audience_sync_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Service can insert sync log"
ON public.marketing_audience_sync_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update sync log"
ON public.marketing_audience_sync_log FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_marketing_audience_updated_at
BEFORE UPDATE ON public.marketing_audience
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync leads to marketing audience
CREATE OR REPLACE FUNCTION public.sync_leads_to_marketing_audience()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
  v_processed INTEGER := 0;
  v_added INTEGER := 0;
  v_updated INTEGER := 0;
  v_lead RECORD;
BEGIN
  -- Create sync log entry
  INSERT INTO marketing_audience_sync_log (sync_type, status)
  VALUES ('auto', 'running')
  RETURNING id INTO v_log_id;

  -- Sync from sales_leads
  FOR v_lead IN 
    SELECT 
      id as lead_id,
      vehicle_reg as reg_plate,
      mileage,
      email,
      phone,
      full_name,
      source,
      'sales_lead' as source_type,
      status as lead_status,
      created_at,
      updated_at
    FROM sales_leads
    WHERE email IS NOT NULL OR phone IS NOT NULL
  LOOP
    v_processed := v_processed + 1;
    
    -- Upsert logic: match by email first, then phone
    INSERT INTO marketing_audience (
      lead_id, reg_plate, mileage, email, phone, full_name, 
      source, source_type, lead_status, synced_at
    )
    VALUES (
      v_lead.lead_id, v_lead.reg_plate, v_lead.mileage, 
      v_lead.email, v_lead.phone, v_lead.full_name,
      v_lead.source, v_lead.source_type, v_lead.lead_status, now()
    )
    ON CONFLICT (email, phone) DO UPDATE SET
      reg_plate = COALESCE(EXCLUDED.reg_plate, marketing_audience.reg_plate),
      mileage = COALESCE(EXCLUDED.mileage, marketing_audience.mileage),
      full_name = COALESCE(EXCLUDED.full_name, marketing_audience.full_name),
      lead_status = EXCLUDED.lead_status,
      synced_at = now(),
      updated_at = now()
    WHERE marketing_audience.updated_at < v_lead.updated_at;
    
    IF FOUND THEN
      IF xmax = 0 THEN
        v_added := v_added + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  -- Sync from abandoned_carts
  FOR v_lead IN 
    SELECT 
      id as lead_id,
      vehicle_reg as reg_plate,
      mileage,
      email,
      phone,
      full_name,
      'abandoned_cart' as source,
      'abandoned_cart' as source_type,
      contact_status as lead_status,
      created_at,
      updated_at
    FROM abandoned_carts
    WHERE (email IS NOT NULL OR phone IS NOT NULL)
      AND is_converted = false
  LOOP
    v_processed := v_processed + 1;
    
    INSERT INTO marketing_audience (
      lead_id, reg_plate, mileage, email, phone, full_name, 
      source, source_type, lead_status, synced_at
    )
    VALUES (
      v_lead.lead_id, v_lead.reg_plate, v_lead.mileage, 
      v_lead.email, v_lead.phone, v_lead.full_name,
      v_lead.source, v_lead.source_type, v_lead.lead_status, now()
    )
    ON CONFLICT (email, phone) DO UPDATE SET
      reg_plate = COALESCE(EXCLUDED.reg_plate, marketing_audience.reg_plate),
      mileage = COALESCE(EXCLUDED.mileage, marketing_audience.mileage),
      full_name = COALESCE(EXCLUDED.full_name, marketing_audience.full_name),
      synced_at = now(),
      updated_at = now()
    WHERE marketing_audience.updated_at < v_lead.updated_at;
    
    IF FOUND THEN
      IF xmax = 0 THEN
        v_added := v_added + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  -- Update sync log
  UPDATE marketing_audience_sync_log
  SET 
    completed_at = now(),
    leads_processed = v_processed,
    leads_added = v_added,
    leads_updated = v_updated,
    status = 'completed'
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'added', v_added,
    'updated', v_updated,
    'log_id', v_log_id
  );
END;
$$;