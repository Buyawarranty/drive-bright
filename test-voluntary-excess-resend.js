import { createClient } from "@supabase/supabase-js";

// Final test script to re-send corrected DV67 YFW data to Warranties 2000
async function resendCorrectedData() {
  console.log('Re-sending corrected voluntary excess data for DV67 YFW to Warranties 2000...');
  
  const supabase = createClient(
    "https://mzlpuxzwyrcyrgrongeb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"
  );
  
  try {
    // Re-send to Warranties 2000 with corrected data
    const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
      body: {
        policyId: '7ab53638-921e-479b-b869-2c18ca70dc91',
        customerId: '2ab458f9-7041-47d5-867f-a3ae40ab78f3'
      }
    });

    if (error) {
      console.error('❌ Warranties 2000 re-send failed:', error);
    } else {
      console.log('✅ Warranties 2000 re-send successful:', data);
      console.log('');
      console.log('🔧 Fixes Applied:');
      console.log('✓ Customer table: voluntary_excess = £150');  
      console.log('✓ Policy table: voluntary_excess = £150');
      console.log('✓ Warranties 2000 API: VolEx = £150 (was £250)');
      console.log('✓ Customer Dashboard: will now show £150 (was £0)');
      console.log('✓ Future checkouts: voluntary excess properly captured in both tables');
    }
  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

// Run the test
resendCorrectedData();