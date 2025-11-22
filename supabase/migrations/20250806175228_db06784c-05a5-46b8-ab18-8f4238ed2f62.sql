-- Update storage policy to allow uploads for policy-documents bucket without authentication
-- This will allow admin uploads to work properly

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can upload policy documents" ON storage.objects;

-- Create a new policy that allows uploads to policy-documents bucket
CREATE POLICY "Allow uploads to policy documents bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'policy-documents');