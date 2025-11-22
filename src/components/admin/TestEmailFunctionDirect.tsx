import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const TestEmailFunctionDirect = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testDirectFunction = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing send-welcome-email-manual directly...');
      
      // Test with existing customer/policy IDs from your error
      const response = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/send-welcome-email-manual', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: 'ffd52dcd-22e6-4f48-9829-b7c0b7f4f0e9',
          policyId: '66b83a2e-dc9b-4014-b980-b440e03b8e97'
        })
      });

      const data = await response.json();
      
      console.log('Direct function response:', { 
        status: response.status, 
        ok: response.ok, 
        data 
      });

      setResult({
        success: response.ok,
        status: response.status,
        data: data,
        error: !response.ok ? data.error || 'Function returned non-200 status' : null
      });

    } catch (error) {
      console.error('Direct test failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Direct Email Function Test</CardTitle>
        <CardDescription>
          Test send-welcome-email-manual function directly with existing records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg text-sm">
          <p>Testing with existing customer/policy from previous test:</p>
          <p>Customer ID: ffd52dcd-22e6-4f48-9829-b7c0b7f4f0e9</p>
          <p>Policy ID: 66b83a2e-dc9b-4014-b980-b440e03b8e97</p>
        </div>

        <Button 
          onClick={testDirectFunction} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testing...' : 'Test Email Function Directly'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  Status: {result.status} - {result.success ? '✅ Success' : '❌ Failed'}
                </p>
                {result.error && (
                  <p className="text-sm text-red-700">Error: {result.error}</p>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">Response Details</summary>
                  <pre className="bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-40">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• This bypasses the test function and calls the email function directly</p>
          <p>• Check browser console for detailed logs</p>
          <p>• If this fails, it's likely a Resend API key issue</p>
        </div>
      </CardContent>
    </Card>
  );
};