-- Update BMW landing page slug to be under warranty-types
UPDATE public.landing_pages 
SET slug = 'warranty-types/bmw',
    canonical_url = 'https://buyawarranty.co.uk/warranty-types/bmw',
    updated_at = now()
WHERE slug = 'car-extended-warranty/bmw';