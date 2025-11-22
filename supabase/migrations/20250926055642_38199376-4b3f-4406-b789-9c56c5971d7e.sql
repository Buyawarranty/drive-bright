-- Add archived status and improve discount codes schema
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS campaign_source TEXT;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS auto_archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS auto_archived_reason TEXT;

-- Add index for better performance on filtering
CREATE INDEX IF NOT EXISTS idx_discount_codes_active_archived ON discount_codes(active, archived);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expiry ON discount_codes(valid_to);
CREATE INDEX IF NOT EXISTS idx_discount_codes_usage ON discount_codes(usage_limit, used_count);

-- Add function to auto-expire discount codes
CREATE OR REPLACE FUNCTION auto_expire_discount_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expired_count INTEGER := 0;
    usage_count INTEGER := 0;
BEGIN
    -- Auto-archive expired codes
    UPDATE discount_codes 
    SET 
        archived = TRUE,
        auto_archived_at = now(),
        auto_archived_reason = 'Expired - past valid_to date',
        updated_at = now()
    WHERE 
        active = TRUE 
        AND archived = FALSE 
        AND valid_to < now();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Auto-archive codes that have reached usage limit
    UPDATE discount_codes 
    SET 
        archived = TRUE,
        auto_archived_at = now(),
        auto_archived_reason = 'Usage limit reached',
        updated_at = now()
    WHERE 
        active = TRUE 
        AND archived = FALSE 
        AND usage_limit IS NOT NULL 
        AND used_count >= usage_limit;
    
    GET DIAGNOSTICS usage_count = ROW_COUNT;
    
    RETURN expired_count + usage_count;
END;
$$;