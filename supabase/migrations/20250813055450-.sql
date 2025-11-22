-- Update the policy documents email template name to be more visible in admin dashboard
UPDATE email_templates 
SET name = 'Policy Documents Email (Welcome Email after Purchase)',
    updated_at = now()
WHERE template_type = 'policy_documents' AND name = '1st Email - Policy Documents Email as soon as purchase made';