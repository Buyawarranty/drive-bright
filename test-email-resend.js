// Test script to resend email for warranty BAW-2508-400117
import { supabase } from "./src/integrations/supabase/client.js";

async function testEmailResend() {
  try {
    console.log('Testing email resend for warranty BAW-2508-400117...');
    
    const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
      body: {
        customerEmail: 'claims@buyawarranty.co.uk'
      }
    });

    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent successfully:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testEmailResend();