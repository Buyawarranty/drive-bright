-- Add 'fake_lead' to the lead_status enum type
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'fake_lead';