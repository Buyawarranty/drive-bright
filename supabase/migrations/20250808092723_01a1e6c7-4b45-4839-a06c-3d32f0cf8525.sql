-- Expand user roles to include more granular permissions
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';

-- Create a table for admin invitations
CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role user_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin invitations
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for admin invitations
CREATE POLICY "Super admins can manage all invitations" 
ON public.admin_invitations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Update the existing is_admin function to handle different admin levels
CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid, _min_level text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (
      (_min_level = 'viewer' AND role IN ('viewer', 'admin', 'super_admin')) OR
      (_min_level = 'admin' AND role IN ('admin', 'super_admin')) OR
      (_min_level = 'super_admin' AND role = 'super_admin')
    )
  );
$$;

-- Create function to accept admin invitation
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record public.admin_invitations;
  result jsonb;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation_record
  FROM public.admin_invitations
  WHERE token = _token 
    AND NOT used 
    AND expires_at > now();
  
  IF invitation_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches invitation email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = _user_id AND email = invitation_record.email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
  END IF;
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, invitation_record.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Mark invitation as used
  UPDATE public.admin_invitations
  SET used = true, used_at = now()
  WHERE id = invitation_record.id;
  
  RETURN jsonb_build_object('success', true, 'role', invitation_record.role);
END;
$$;