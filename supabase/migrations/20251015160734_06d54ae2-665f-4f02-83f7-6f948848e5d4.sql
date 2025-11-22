-- Upload logo to storage bucket (this is a comment - the actual file needs to be uploaded manually via the Supabase dashboard)
-- The logo should be uploaded to the policy-documents bucket with the path: buy-a-warranty-logo.png

-- Ensure the logo is publicly accessible by verifying the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'policy-documents';