import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export const TestAutomatedEmail = () => {
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [planType, setPlanType] = useState('basic');
  const [paymentType, setPaymentType] = useState('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    if (!testEmail) return;

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-automated-email', {
        body: {
          testEmail,
          planType,
          paymentType
        }
      });

      if (error) {
        setResult({
          success: false,
          error: error.message,
          type: 'error'
        });
      } else {
        setResult({
          success: true,
          data: data,
          type: 'success'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Test Automated Email System
        </CardTitle>
        <CardDescription>
          Safely test the automated welcome email system using test email addresses.
          The system will create test records and send a real email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Test Email Address</label>
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            For safety, use an email containing "test" or a test domain like @example.com
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan Type</label>
            <Select value={planType} onValueChange={setPlanType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
                <SelectItem value="electric">Electric Vehicle</SelectItem>
                <SelectItem value="phev">PHEV Hybrid</SelectItem>
                <SelectItem value="motorbike">Motorbike</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Type</label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="twoYear">Two Year</SelectItem>
                <SelectItem value="threeYear">Three Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleTest} 
          disabled={isLoading || !testEmail}
          className="w-full"
        >
          {isLoading ? 'Testing...' : 'Run Email Test'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-2">
                      <p className="font-medium text-green-800">Test completed successfully!</p>
                      {result.data?.testResults && (
                        <div className="text-sm text-green-700 space-y-1">
                          <p>Customer ID: {result.data.testResults.customerId}</p>
                          <p>Policy ID: {result.data.testResults.policyId}</p>
                          <p>Warranty Number: {result.data.testResults.warrantyNumber}</p>
                          <p>Email sent to: {result.data.testResults.testEmail}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-red-800">Test failed</p>
                      <p className="text-sm text-red-700">{result.error}</p>
                      {result.details && (
                        <pre className="text-xs text-red-600 bg-red-100 p-2 rounded mt-2 overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Testing Guidelines:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use test email addresses (containing "test" or @example.com)</li>
            <li>• This creates real database records with "TEST-" prefix</li>
            <li>• Real emails will be sent to the test address</li>
            <li>• Test records can be cleaned up later if needed</li>
            <li>• Check the function logs for detailed debugging info</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};