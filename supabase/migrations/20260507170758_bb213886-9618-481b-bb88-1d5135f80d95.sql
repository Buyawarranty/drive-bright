UPDATE public.customers
SET is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
WHERE id = '5915bd6b-4196-4100-9fca-6b17143fabb2';