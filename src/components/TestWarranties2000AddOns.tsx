import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const TestWarranties2000AddOns = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  const testWarrantiesAddOnsAPI = async () => {
    try {
      setLoading(true);
      setResponse('');
      
      console.log('Testing W2000 with add-ons...');
      
      // Create a test customer with add-ons
      const testCustomerData = {
        name: 'Test Customer AddOns',
        email: `test-addons-${Date.now()}@example.com`,
        plan_type: 'basic',
        payment_type: '12months',
        registration_plate: 'TEST123',
        vehicle_make: 'FORD',
        vehicle_model: 'FOCUS',
        vehicle_year: '2020',
        mileage: '50000',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '01234567890',
        street: 'Test Street',
        town: 'Test Town',
        postcode: 'TE5T 1NG',
        country: 'United Kingdom',
        voluntary_excess: 0,
        final_amount: 299,
        warranty_reference_number: `TEST-${Date.now()}`,
        status: 'Active',
        claim_limit: 1250, // Test with 1250 claim limit
        // Add-ons - ALL SET TO TRUE for testing
        tyre_cover: true,
        wear_tear: true,
        europe_cover: true,
        transfer_cover: true,
        breakdown_recovery: true,
        vehicle_rental: true,
        mot_fee: true
      };

      console.log('Creating test customer with add-ons:', testCustomerData);

      // Create customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert(testCustomerData)
        .select()
        .single();

      if (customerError) {
        throw new Error(`Customer creation failed: ${customerError.message}`);
      }

      console.log('Test customer created:', customer.id);

        // Create customer policy with add-ons
        const policyData = {
          customer_id: customer.id,
          email: customer.email,
          plan_type: customer.plan_type,
          payment_type: customer.payment_type,
          policy_number: `POL-${Date.now()}`,
          status: 'active',
          policy_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          claim_limit: 1250, // Test with 1250 claim limit
          // Add-ons - ALL SET TO TRUE for testing
          tyre_cover: true,
          wear_tear: true,
          europe_cover: true,
          transfer_cover: true,
          breakdown_recovery: true,
          vehicle_rental: true,
          mot_fee: true
        };

      console.log('Creating policy with add-ons:', policyData);

      const { data: policy, error: policyError } = await supabase
        .from('customer_policies')
        .insert(policyData)
        .select()
        .single();

      if (policyError) {
        throw new Error(`Policy creation failed: ${policyError.message}`);
      }

      console.log('Test policy created:', policy.id);
      
      // Now call the W2000 function
      console.log('Calling W2000 function...');
      const { data, error } = await supabase.functions.invoke('send-to-warranties-2000', {
        body: { policyId: policy.id }
      });
      
      if (error) {
        throw error;
      }
      
      console.log('W2000 Response:', data);
      
      setResponse(JSON.stringify(data, null, 2));
      
      if (data.success) {
        toast({
          title: "Success",
          description: "W2000 test with add-ons completed successfully",
        });
      } else {
        toast({
          title: "API Error",
          description: "W2000 API returned an error - check response below",
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('Test error:', error);
      setResponse(JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: error 
      }, null, 2));
      
      toast({
        title: "Test Failed",
        description: error.message || "An error occurred during testing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>🧪 Test Warranties 2000 Add-Ons Integration</CardTitle>
        <CardDescription>
          This creates a test customer and policy with ALL add-ons enabled and sends it to W2000 API to see exactly what data is being sent and rejected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testWarrantiesAddOnsAPI}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing W2000 Add-Ons...' : 'Test W2000 Add-Ons Integration'}
        </Button>
        
        {response && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">API Response:</h3>
            <Textarea
              value={response}
              readOnly
              className="min-h-[300px] font-mono text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestWarranties2000AddOns;