import { createClient } from "@supabase/supabase-js";

// Test script to re-send corrected data for BAW-2509-400313 to Warranties 2000
async function resendCorrectedData() {
  console.log('Re-sending corrected data for BAW-2509-400313 to Warranties 2000...');
  
  const supabase = createClient(
    "https://mzlpuxzwyrcyrgrongeb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"
  );
  
  try {
    const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
      body: {
        policyId: '7ab53638-921e-479b-b869-2c18ca70dc91',
        customerId: '2ab458f9-7041-47d5-867f-a3ae40ab78f3'
      }
    });

    if (error) {
      console.error('Warranties 2000 re-send failed:', error);
    } else {
      console.log('Warranties 2000 re-send successful:', data);
      console.log('Expected corrections:');
      console.log('- Claim Limit: £750 (was £1,250)');
      console.log('- Voluntary Excess: £150 (was £250)');
      console.log('- Add-ons enabled: Vehicle recovery, Vehicle rental, Tyre cover, MOT test fee');
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}

// Run the test
resendCorrectedData();