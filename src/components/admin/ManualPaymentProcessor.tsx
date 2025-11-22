import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ManualPaymentProcessor = () => {
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const processPayment = async () => {
    if (!sessionId.trim()) {
      toast.error('Please enter a Stripe session ID');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('🔄 Manually processing Stripe payment:', sessionId);
      
      // Call the process-stripe-success function
      // We'll need to provide default values since we don't have the plan/payment info
      const { data, error } = await supabase.functions.invoke('process-stripe-success', {
        body: {
          sessionId: sessionId.trim(),
          planId: 'manual_processing', // Will be overridden by session metadata
          paymentType: 'manual_processing' // Will be overridden by session metadata
        }
      });

      if (error) {
        console.error('❌ Payment processing error:', error);
        toast.error(`Failed to process payment: ${error.message}`);
        setResult({ success: false, error: error.message });
      } else {
        console.log('✅ Payment processed successfully:', data);
        toast.success('Payment processed successfully!');
        setResult({ success: true, data });
      }
    } catch (error: any) {
      console.error('❌ Unexpected error:', error);
      toast.error(`Unexpected error: ${error.message}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Manual Payment Processor</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Use this tool to manually process Stripe payments that didn't complete automatically. 
        Enter the Stripe session ID (starts with "cs_") to retry processing.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Stripe Session ID</label>
          <Input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="cs_live_..."
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Find this in the Stripe dashboard under the payment details
          </p>
        </div>

        <Button 
          onClick={processPayment} 
          disabled={loading || !sessionId.trim()}
          className="w-full"
        >
          {loading ? 'Processing...' : 'Process Payment'}
        </Button>

        {result && (
          <div className="mt-4">
            <label className="text-sm font-medium mb-2 block">Result</label>
            <Textarea
              value={JSON.stringify(result, null, 2)}
              readOnly
              rows={12}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h3 className="font-medium text-sm mb-2">How to find the Session ID:</h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to Stripe Dashboard → Payments</li>
          <li>Find the payment (search by email or amount)</li>
          <li>Click on the payment to view details</li>
          <li>Look for "Checkout Session ID" - it starts with "cs_"</li>
          <li>Copy that ID and paste it here</li>
        </ol>
      </div>
    </Card>
  );
};
