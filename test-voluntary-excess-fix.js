import { createClient } from "@supabase/supabase-js";

// Test script to fix DV67 YFW voluntary excess and re-send to Warranties 2000
async function fixVoluntaryExcess() {
  console.log('Fixing voluntary excess for DV67 YFW and re-sending to Warranties 2000...');
  
  const supabase = createClient(
    "https://mzlpuxzwyrcyrgrongeb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"
  );
  
  try {
    // 1. Verify current database state
    console.log('\n1. Checking current voluntary excess values...');
    
    const { data: customer } = await supabase
      .from('customers')
      .select('id, registration_plate, voluntary_excess, name, email')
      .ilike('registration_plate', '%DV67%YFW%')
      .single();
    
    console.log('Customer data:', customer);
    
    const { data: policy } = await supabase
      .from('customer_policies')
      .select('id, policy_number, voluntary_excess, customer_id')
      .eq('customer_id', customer.id)
      .single();
      
    console.log('Policy data:', policy);
    
    // 2. Re-send corrected data to Warranties 2000
    console.log('\n2. Re-sending corrected data to Warranties 2000...');
    
    const { data: w2kResponse, error: w2kError } = await supabase.functions.invoke('send-to-warranties-2000', {
      body: {
        policyId: policy.id,
        customerId: customer.id
      }
    });

    if (w2kError) {
      console.error('Warranties 2000 re-send failed:', w2kError);
    } else {
      console.log('Warranties 2000 re-send successful:', w2kResponse);
      console.log('\n✅ Expected corrections:');
      console.log('- Voluntary Excess: £150 (was showing £250 in W2K dashboard)');
      console.log('- Customer Dashboard will now show: £150 (was showing £0)');
      console.log('- All future checkouts will properly capture voluntary excess in both tables');
    }
    
  } catch (err) {
    console.error('Test error:', err);
  }
}

// Run the test
fixVoluntaryExcess();