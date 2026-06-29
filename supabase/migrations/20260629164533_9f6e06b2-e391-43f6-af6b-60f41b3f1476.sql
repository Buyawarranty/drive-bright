UPDATE auth.users
SET encrypted_password = crypt('Murray!Andy2026', gen_salt('bf')),
    updated_at = now()
WHERE id = '8de2a98d-9d5c-4cab-b609-bcb4b13639bb';