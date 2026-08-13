UPDATE public.customers
SET email = 'kelvinmushambi@yahoo.co.uk',
    name = 'Kelvin Mushambi',
    updated_at = now()
WHERE id = '1b2e7cc9-0897-4f42-8a0e-7d9b440af15d';

UPDATE public.customers
SET name = 'Kelvin Mushambi',
    updated_at = now()
WHERE id = '11b67b34-0de6-4eff-8d87-31c739e10e41';

UPDATE public.customer_policies
SET email = 'kelvinmushambi@yahoo.co.uk',
    customer_full_name = 'Kelvin Mushambi',
    updated_at = now()
WHERE id = '603f8a11-d16e-4c44-9d32-696cb6eb008f';

UPDATE public.customer_policies
SET customer_full_name = 'Kelvin Mushambi',
    updated_at = now()
WHERE id = 'c4e9ff0e-f903-436d-bfe6-69eddf0ff2a6';