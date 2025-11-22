// Manual email send for KO15 HPJ customer
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendEmail() {
  try {
    console.log('Sending manual email for KO15 HPJ customer...');
    
    const { data, error } = await supabase.functions.invoke('send-policy-documents', {
      body: {
        recipientEmail: 'support@buyawarranty.co.uk',
        forceResend: true,
        variables: {
          planType: 'Premium Car Plan',
          customerName: 'humara ashraf',
          paymentType: '12 months',
          policyNumber: 'BAW-2509-400327',
          registrationPlate: 'KO15 HPJ',
          paymentSource: 'bumper'
        }
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

sendEmail();