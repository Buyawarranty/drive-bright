-- Add password_reset_by_user field to welcome_emails table to track if user has reset their password
ALTER TABLE public.welcome_emails 
ADD COLUMN password_reset_by_user boolean NOT NULL DEFAULT false;

-- Add index for better performance when checking reset status
CREATE INDEX idx_welcome_emails_email_reset_status ON public.welcome_emails(email, password_reset_by_user);

-- Add comment for documentation
COMMENT ON COLUMN public.welcome_emails.password_reset_by_user IS 'Tracks whether the user has manually reset their password. Once true, login details should not be included in future welcome emails.';