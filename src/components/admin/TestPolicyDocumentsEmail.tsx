import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Mail } from 'lucide-react';

export const TestPolicyDocumentsEmail = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendTestEmail = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing send-policy-documents with sample data...');
      
      const { data, error } = await supabase.functions.invoke('send-policy-documents', {
        body: {
          recipientEmail: 'info@buyawarranty.co.uk',
          variables: {
            planType: 'Premium Car Plan',
            customerName: 'Test Customer',
            paymentType: 'yearly',
            policyNumber: 'BAW-2009-400123',
            registrationPlate: 'AB12 CDE',
            paymentSource: 'stripe'
          },
          forceResend: true
        }
      });

      if (error) {
        console.error('Policy documents test error:', error);
        toast({
          title: "Test Failed",
          description: error.message || "Failed to send test email",
          variant: "destructive",
        });
        setResult({ error: error.message });
      } else {
        console.log('Policy documents test successful:', data);
        toast({
          title: "Test Email Sent!",
          description: "Policy documents email sent to info@buyawarranty.co.uk",
        });
        setResult({ success: true, data });
      }
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Test Policy Documents Email
        </CardTitle>
        <CardDescription>
          Send a test policy documents email to info@buyawarranty.co.uk with sample data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Test Data:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Email: info@buyawarranty.co.uk</li>
            <li>• Plan: Premium Car Plan</li>
            <li>• Customer: Test Customer</li>
            <li>• Policy: BAW-2009-400123</li>
            <li>• Registration: AB12 CDE</li>
            <li>• Payment: Yearly (Stripe)</li>
          </ul>
        </div>

        <Button 
          onClick={sendTestEmail} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Sending Test Email...' : 'Send Test Policy Documents Email'}
        </Button>

        {result && (
          <div className="mt-4">
            {result.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✅ Test email sent successfully!</p>
                <p className="text-sm text-green-700 mt-2">
                  Check info@buyawarranty.co.uk for the policy documents email with updated styling and attachments.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">❌ Test failed</p>
                <p className="text-sm text-red-700 mt-2">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};