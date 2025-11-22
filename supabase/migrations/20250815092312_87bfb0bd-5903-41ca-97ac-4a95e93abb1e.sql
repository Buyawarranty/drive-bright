-- Remove the old policy documents email template to prevent duplicate emails
DELETE FROM public.email_templates 
WHERE template_type = 'policy_documents' 
AND subject = 'Congratulations — Your Buyawarranty.co.uk Protection is Now Active!';