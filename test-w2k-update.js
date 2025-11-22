import { createClient } from "@/integrations/supabase/client";

// Quick test to re-send FH11 SSK data to Warranties 2000
async function testW2KUpdate() {
  console.log('Testing Warranties 2000 update for FH11 SSK...');
  
  const { data, error } = await createClient().functions.invoke('send-to-warranties-2000', {
    body: {
      policyId: '82a13eb3-dfb7-45b1-94e3-b858ae47ede3',
      customerId: '6eb8b36e-2d2c-48b2-89de-566f2a96ed0d'
    }
  });

  if (error) {
    console.error('Warranties 2000 update failed:', error);
  } else {
    console.log('Warranties 2000 update successful:', data);
  }
}

// Call the function
testW2KUpdate();