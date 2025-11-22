-- Update all email templates to use support@buyawarranty.co.uk instead of info@buyawarranty.co.uk
UPDATE email_templates 
SET from_email = 'support@buyawarranty.co.uk' 
WHERE from_email = 'info@buyawarranty.co.uk';

-- Update the default value for new email templates
ALTER TABLE email_templates ALTER COLUMN from_email SET DEFAULT 'support@buyawarranty.co.uk';