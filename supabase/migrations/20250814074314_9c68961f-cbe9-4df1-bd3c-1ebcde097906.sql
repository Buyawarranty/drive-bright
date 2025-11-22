-- Delete unused/inactive email templates, keeping only the ones currently being used in the codebase

-- Templates that are actually used in the code:
-- 'welcome' - used in process-warranty-purchase and send-welcome-email functions  
-- 'policy_documents' - used in send-policy-documents function
-- 'feedback' - used in send-welcome-email function and has BCC integration

-- Delete inactive and unused templates
DELETE FROM email_templates 
WHERE template_type IN (
  'abandoned_cart_24h',  -- inactive
  'educational',         -- inactive  
  'sales'               -- inactive and appears to be duplicate
) 
OR (template_type = 'welcome' AND name != 'Policy Documents Email (Welcome Email after Purchase)')
OR id IN (
  -- Delete duplicate/redundant templates keeping only the main ones
  SELECT id FROM email_templates 
  WHERE template_type = 'welcome' 
  AND name NOT IN ('Policy Documents Email (Welcome Email after Purchase)')
  AND id != (SELECT id FROM email_templates WHERE template_type = 'welcome' AND is_active = true LIMIT 1)
);

-- Also clean up any abandoned cart email templates table if they exist and are unused
-- DELETE FROM abandoned_cart_email_templates WHERE trigger_type NOT IN ('pricing_page_view', 'plan_selected');