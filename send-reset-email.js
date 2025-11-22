// Script to send password reset email
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendPasswordReset() {
  try {
    console.log('Sending password reset email...');
    
    const { data, error } = await supabase.functions.invoke('send-password-reset-email', {
      body: {
        email: 'support@buyawarranty.co.uk'
      }
    });
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Success:', data);
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

sendPasswordReset();