-- Add cart_metadata column to abandoned_carts table for storing additional order details
ALTER TABLE public.abandoned_carts 
ADD COLUMN IF NOT EXISTS cart_metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.abandoned_carts.cart_metadata IS 'Stores extended cart data including pricing, address, and protection add-ons for email campaigns';