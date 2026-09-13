CREATE POLICY "management read whatsapp attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-attachments' AND can_manage_lead_routing(auth.uid()));

CREATE POLICY "management upload whatsapp attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-attachments' AND can_manage_lead_routing(auth.uid()));