CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_trgm_email ON public.abandoned_carts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_trgm_full_name ON public.abandoned_carts USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_trgm_phone ON public.abandoned_carts USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_trgm_vehicle_reg ON public.abandoned_carts USING gin (vehicle_reg gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_updated_at_desc ON public.abandoned_carts (updated_at DESC);