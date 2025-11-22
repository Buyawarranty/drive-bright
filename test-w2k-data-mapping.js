import { createClient } from "@supabase/supabase-js";

// Test the fixed W2000 data mapping for prajwalchauhan2001@gmail.com
async function testW2KDataMapping() {
  console.log('Testing W2000 data mapping fixes for prajwalchauhan2001@gmail.com...');
  
  const supabase = createClient(
    "https://mzlpuxzwyrcyrgrongeb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"
  );
  
  try {
    const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
      body: {
        customerId: '8cbfa1b0-39b9-4d89-a36c-8b38193469e2'
      }
    });

    if (error) {
      console.error('W2000 data mapping test failed:', error);
    } else {
      console.log('W2000 data mapping test successful:', data);
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}

// Run the test
testW2KDataMapping();