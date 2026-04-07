-- Add the missing 'upgraded' value to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'upgraded' AFTER 'upsell';