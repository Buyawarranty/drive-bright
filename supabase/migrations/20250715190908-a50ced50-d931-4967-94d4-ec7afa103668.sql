-- Create storage bucket for policy documents
INSERT INTO storage.buckets (id, name, public) VALUES ('policy-documents', 'policy-documents', true);

-- Create policies for the bucket
CREATE POLICY "Anyone can view policy documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'policy-documents');

CREATE POLICY "Admins can upload policy documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'policy-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update policy documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'policy-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete policy documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'policy-documents' AND auth.uid() IS NOT NULL);