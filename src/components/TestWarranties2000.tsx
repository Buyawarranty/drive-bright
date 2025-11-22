import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const TestWarranties2000 = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>('');

  const testWarrantiesAPI = async () => {
    setLoading(true);
    setResponse('');

    // Test data fixing the specific validation errors
    const testData = {
      Title: "Mr",
      First: "John",
      Surname: "Test", 
      Addr1: "123 Test Street",
      Addr2: "",
      Town: "London",
      PCode: "SW1A 1AA",
      Tel: "02071234567",
      Mobile: "07700123456",
      EMail: "john.test@example.com",
      PurDate: new Date().toISOString().split('T')[0],
      Make: "Ford",
      RegNum: "AB12 CDE",
      Mileage: "50000",
      EngSize: "1.6", // API requires this field
      PurPrc: "15000",
      RegDate: "2020-01-01",
      WarType: "B-BASIC", // Use correct warranty type
      Month: "12",
      MaxClm: "500", // Use valid claim amount
      Notes: "Test registration",
      Ref: "BAW-2501-400001",
      MOTDue: "2025-12-31",
      // Add-ons using correct W2000 API field names and format
      TyreCover: "Y", // Y/N format as expected by API
      WearTear: "Y", // Y/N format as expected by API  
      EuroCover: "N", // Y/N format as expected by API
      Recovery: "Y", // Y/N format - 24/7 Recovery/Breakdown
      Rental: "N" // Y/N format - Vehicle Rental
      // Note: Transfer cover excluded as per requirements
    };
    
    console.log('=== FIXING VALIDATION ERRORS ===');
    console.log('EngSize:', testData.EngSize);
    console.log('WarType:', testData.WarType);
    console.log('MaxClm:', testData.MaxClm);

    try {
      console.log('Testing Warranties 2000 API with data:', testData);
      
      const { data, error } = await supabase.functions.invoke('warranties-2000-registration', {
        body: testData
      });

      console.log('Full function response - data:', data);
      console.log('Full function response - error:', error);

      if (error) {
        console.error('Supabase function error:', error);
        setResponse(`Supabase Function Error:\n${JSON.stringify(error, null, 2)}\n\nThis means the edge function itself failed, not the API call.`);
        toast.error(`Function failed: ${error.message || 'Unknown error'}`);
      } else if (data) {
        console.log('Function executed successfully, API response:', data);
        setResponse(`Function Response:\n${JSON.stringify(data, null, 2)}`);
        
        if (data.success) {
          toast.success('API call successful!');
        } else {
          toast.error(`API validation failed: ${data.error || 'Unknown error'}`);
          console.error('API validation details:', data.details);
        }
      } else {
        setResponse('No response data received from function');
        toast.error('No response received');
      }
    } catch (err) {
      console.error('Exception calling function:', err);
      setResponse(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      toast.error('Function call failed with exception');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Warranties 2000 API</CardTitle>
        <CardDescription>
          Test the integration with Warranties 2000 registration system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testWarrantiesAPI} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing API...' : 'Test Warranties 2000 API'}
        </Button>
        
        {response && (
          <div className="space-y-2">
            <label className="text-sm font-medium">API Response:</label>
            <Textarea 
              value={response} 
              readOnly 
              className="min-h-[200px] font-mono text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestWarranties2000;