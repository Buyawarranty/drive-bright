-- Update the policy documents email template to use the correct subject line
UPDATE public.email_templates 
SET subject = '🎉 Congratulations — Your Buyawarranty.co.uk Protection is Now Registered! ✅'
WHERE template_type = 'policy_documents' 
AND name = 'Policy Documents Email (Welcome Email after Purchase)';