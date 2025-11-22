import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export const EmailFunctionDiagnostics = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setResults(null);

    const diagnostics = {
      timestamp: new Date().toISOString(),
      tests: [] as any[]
    };

    try {
      // Test 1: Check send-welcome-email-manual function basic connectivity
      console.log('🔍 Testing send-welcome-email-manual function...');
      
      try {
        const response1 = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/send-welcome-email-manual', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE7NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({}) // Empty body to test basic function response
        });

        const data1 = await response1.json();
        
        diagnostics.tests.push({
          name: 'send-welcome-email-manual Basic Connectivity',
          status: response1.status,
          success: response1.status < 500, // Accept 4xx as "function is working" but has validation issues
          response: data1,
          details: `Status: ${response1.status}, OK: ${response1.ok}`
        });
      } catch (error) {
        diagnostics.tests.push({
          name: 'send-welcome-email-manual Basic Connectivity',
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          details: 'Network or connection error'
        });
      }

      // Test 2: Check resend-welcome-email function
      try {
        const response2 = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/resend-welcome-email', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerEmail: 'test@example.com'
          })
        });

        const data2 = await response2.json();
        
        diagnostics.tests.push({
          name: 'resend-welcome-email Function',
          status: response2.status,
          success: response2.ok,
          response: data2,
          details: `Status: ${response2.status}, OK: ${response2.ok}`
        });
      } catch (error) {
        diagnostics.tests.push({
          name: 'resend-welcome-email Function',
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          details: 'Network or connection error'
        });
      }

      // Test 3: Check send-email function
      try {
        const response3 = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/send-email', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: 'test',
            recipientEmail: 'test@example.com'
          })
        });

        const data3 = await response3.json();
        
        diagnostics.tests.push({
          name: 'send-email Function',
          status: response3.status,
          success: response3.ok,
          response: data3,
          details: `Status: ${response3.status}, OK: ${response3.ok}`
        });
      } catch (error) {
        diagnostics.tests.push({
          name: 'send-email Function',
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          details: 'Network or connection error'
        });
      }

      // Test 4: Check using Supabase client invoke method
      try {
        const { data: data4, error: error4 } = await supabase.functions.invoke('send-welcome-email-manual', {
          body: {
            customerId: 'test-id',
            policyId: 'test-policy-id'
          }
        });

        diagnostics.tests.push({
          name: 'Supabase Client Invoke Method',
          status: error4 ? 'ERROR' : 'SUCCESS',
          success: !error4,
          response: data4,
          error: error4,
          details: `Using supabase.functions.invoke()`
        });
      } catch (error) {
        diagnostics.tests.push({
          name: 'Supabase Client Invoke Method',
          status: 'ERROR',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          details: 'Supabase client error'
        });
      }

      setResults(diagnostics);

    } catch (error) {
      console.error('Diagnostics failed:', error);
      setResults({
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        tests: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (test: any) => {
    if (test.status === 'ERROR' || !test.success) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>;
    } else if (test.status >= 200 && test.status < 300) {
      return <Badge variant="default" className="flex items-center gap-1 bg-green-500">
        <CheckCircle className="h-3 w-3" />
        Success
      </Badge>;
    } else {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Info className="h-3 w-3" />
        {test.status}
      </Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Email Function Diagnostics
        </CardTitle>
        <CardDescription>
          Comprehensive testing of all email-related edge functions to identify issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Running Diagnostics...' : 'Run Email Function Diagnostics'}
        </Button>

        {results && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Test run at: {new Date(results.timestamp).toLocaleString()}
            </div>

            {results.error && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Diagnostics Error: {results.error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {results.tests?.map((test: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{test.name}</h4>
                    {getStatusBadge(test)}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {test.details}
                  </div>

                  {test.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
                      <strong>Error:</strong> {test.error}
                    </div>
                  )}

                  {test.response && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-gray-700">
                        Response Details
                      </summary>
                      <pre className="bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                        {JSON.stringify(test.response, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Common Issues:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Status 500: Missing RESEND_API_KEY environment variable</li>
                  <li>Status 422: Missing required parameters (customerId, policyId)</li>
                  <li>Status 404: Function not found or not deployed</li>
                  <li>Network errors: Function deployment or connectivity issues</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};