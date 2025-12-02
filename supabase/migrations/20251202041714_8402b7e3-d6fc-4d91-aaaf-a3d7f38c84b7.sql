-- Add labour_rate column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS labour_rate INTEGER DEFAULT 70;

COMMENT ON COLUMN customers.labour_rate IS 'Selected labour rate per hour (£50, £70, or £100) for warranty claims';