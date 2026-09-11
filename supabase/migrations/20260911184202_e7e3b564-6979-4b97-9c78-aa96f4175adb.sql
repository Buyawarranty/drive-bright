ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sale_quoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_pricing_version_id uuid,
  ADD COLUMN IF NOT EXISTS sale_pricing_version_label text;

COMMENT ON COLUMN public.customers.sale_quoted_at IS 'When the agent produced/confirmed the quoted total used for the discount (point of sale timestamp).';
COMMENT ON COLUMN public.customers.sale_pricing_version_label IS 'Price model that was live when the quote was given (managers can verify discounts against it).';