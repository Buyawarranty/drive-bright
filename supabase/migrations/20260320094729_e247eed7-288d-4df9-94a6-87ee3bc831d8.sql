ALTER TABLE claims_submissions 
  ADD COLUMN IF NOT EXISTS purchase_mileage integer,
  ADD COLUMN IF NOT EXISTS mileage_driven integer,
  ADD COLUMN IF NOT EXISTS days_on_risk integer,
  ADD COLUMN IF NOT EXISTS warranty_start_date timestamptz;