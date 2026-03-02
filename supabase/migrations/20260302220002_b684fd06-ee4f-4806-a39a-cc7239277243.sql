
-- Drop the old INSERT-only trigger
DROP TRIGGER IF EXISTS trg_auto_create_lead_from_cart ON public.abandoned_carts;

-- Recreate trigger to fire on both INSERT and UPDATE
CREATE TRIGGER trg_auto_create_lead_from_cart
AFTER INSERT OR UPDATE ON public.abandoned_carts
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_lead_from_abandoned_cart();
