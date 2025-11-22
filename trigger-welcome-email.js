// Trigger welcome email for estaservicesltd@gmail.com
import { supabase } from './src/integrations/supabase/client.js';

async function triggerWelcomeEmail() {
  try {
    console.log('Triggering welcome email for estaservicesltd@gmail.com...');
    
    const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
      body: {
        customerEmail: 'estaservicesltd@gmail.com'
      }
    });

    if (error) {
      console.error('Error triggering welcome email:', error);
    } else {
      console.log('Welcome email triggered successfully:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

triggerWelcomeEmail();