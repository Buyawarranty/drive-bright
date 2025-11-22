-- Create a test user with confirmed email directly in auth.users
-- This bypasses the email confirmation requirement

-- First, let's check if we can insert into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  confirmation_token,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'customer2@gmail.com',
  crypt('testpassword123', gen_salt('bf')),
  now(), -- Email confirmed immediately
  now(),
  '',
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false
);