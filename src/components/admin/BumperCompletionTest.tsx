import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export const BumperCompletionTest = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [email, setEmail] = useState('uxdesign12@gmail.com');

  const triggerManualCompletion = async () => {
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    setResponse('');
    
    try {
      console.log('🔄 Triggering manual Bumper completion for:', email);
      
      const { data, error } = await supabase.functions.invoke('manual-bumper-completion', {
        body: { email }
      });

      if (error) {
        console.error('❌ Manual completion error:', error);
        setResponse(`Error: ${error.message}`);
        toast.error('Manual completion failed');
      } else {
        console.log('✅ Manual completion response:', data);
        setResponse(JSON.stringify(data, null, 2));
        toast.success('Manual completion triggered successfully');
      }
    } catch (error) {
      console.error('💥 Request failed:', error);
      setResponse(`Error: ${error}`);
      toast.error('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const testNewCustomerCreation = async () => {
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    setResponse('');
    
    try {
      console.log('🆕 Creating new customer record for:', email);
      
      // First check if customer already exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id, email')
        .eq('email', email)
        .single();

      if (existing) {
        setResponse(`Customer already exists: ${existing.id}`);
        toast.info('Customer already exists in database');
        setLoading(false);
        return;
      }

      // Create new customer with sample data
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: 'Bumper Customer',
          email: email,
          phone: '07960111131',
          first_name: 'Bumper',
          last_name: 'Customer',
          street: '123 Sample Street',
          town: 'London',
          postcode: 'SW1A 1AA',
          plan_type: 'Basic',
          status: 'Active',
          registration_plate: 'AB12CDE',
          vehicle_make: 'AUDI',
          vehicle_model: 'A4',
          vehicle_year: '2020',
          mileage: '50000',
          payment_type: 'monthly',
          bumper_order_id: `MANUAL_${Date.now()}`
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Customer creation error:', error);
        setResponse(`Error creating customer: ${error.message}`);
        toast.error('Failed to create customer');
      } else {
        console.log('✅ Customer created:', data);
        setResponse(`Customer created successfully:\n${JSON.stringify(data, null, 2)}`);
        toast.success('Customer created successfully');
      }
    } catch (error) {
      console.error('💥 Customer creation failed:', error);
      setResponse(`Error: ${error}`);
      toast.error('Customer creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Manual Bumper Completion</CardTitle>
        <CardDescription>
          Manually process Bumper orders that didn't get processed automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Customer Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            className="mt-1"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={triggerManualCompletion} 
            disabled={loading}
            variant="default"
          >
            {loading ? 'Processing...' : 'Process Existing Customer'}
          </Button>
          
          <Button 
            onClick={testNewCustomerCreation} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Creating...' : 'Create Sample Customer'}
          </Button>
        </div>
        
        {response && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Response:</label>
            <Textarea
              value={response}
              readOnly
              className="h-40 font-mono text-sm"
            />
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Process Existing:</strong> Processes existing customer (triggers W2K registration and welcome email)</p>
          <p><strong>Create Sample:</strong> Creates a new customer record with sample data for testing</p>
        </div>
      </CardContent>
    </Card>
  );
};