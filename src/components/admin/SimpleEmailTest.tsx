import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export const SimpleEmailTest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleQuickTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Starting test with fixed test email...');
      
      const { data, error } = await supabase.functions.invoke('test-automated-email', {
        body: {
          testEmail: 'test@example.com',
          planType: 'basic',
          paymentType: 'monthly'
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        setResult({
          success: false,
          error: error.message,
          details: error
        });
      } else {
        setResult({
          success: data?.success || false,
          data: data,
          error: data?.error || null
        });
      }
    } catch (error) {
      console.error('Test failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Simple Email Test</CardTitle>
        <CardDescription>
          One-click test with predefined safe values
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">
            This will test with: test@example.com, basic plan, monthly payment
          </p>
        </div>

        <Button 
          onClick={handleQuickTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testing...' : 'Run Quick Test'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {result.success ? '✅ Test Success' : '❌ Test Failed'}
                </p>
                {result.error && (
                  <p className="text-sm text-red-700">{result.error}</p>
                )}
                {result.data && (
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Check browser console for detailed logs</p>
          <p>• Check Supabase function logs for server-side info</p>
          <p>• If no logs appear, the function may not be deployed</p>
        </div>
      </CardContent>
    </Card>
  );
};