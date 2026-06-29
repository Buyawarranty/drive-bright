
UPDATE public.admin_users
SET email = 'andy.murray@buyawarranty.co.uk', updated_at = now()
WHERE email = 'andrew.murray@buyawarranty.co.uk';

UPDATE auth.users
SET email = 'andy.murray@buyawarranty.co.uk',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email','andy.murray@buyawarranty.co.uk'),
    email_change = NULL,
    email_change_token_new = '',
    email_change_token_current = '',
    updated_at = now()
WHERE email = 'andrew.murray@buyawarranty.co.uk';

UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', '"andy.murray@buyawarranty.co.uk"'),
    updated_at = now()
WHERE identity_data->>'email' = 'andrew.murray@buyawarranty.co.uk';
