import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ReconciliationResults {
  stripeResults: {
    totalSessions: number;
    missingSessions: number;
    missingSessionIds: Array<{
      id: string;
      email: string;
      amount: number;
      created: string;
    }>;
  };
  bumperResults: {
    note: string;
    suggestion: string;
    missingApplications: any[];
  };
  summary: {
    totalExistingCustomers: number;
    potentialMissingStripeOrders: number;
    potentialMissingBumperOrders: number;
    totalErrors: number;
    lastChecked: string;
  };
  errors: string[];
}

const OrderReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  const runReconciliation = async () => {
    setLoading(true);
    setResults(null);

    try {
      console.log('🔄 Starting order reconciliation...');
      
      const { data, error } = await supabase.functions.invoke('reconcile-orders');

      if (error) {
        console.error('❌ Reconciliation error:', error);
        toast.error(`Reconciliation failed: ${error.message}`);
      } else {
        console.log('✅ Reconciliation complete:', data);
        setResults(data.results);
        toast.success('Order reconciliation completed');
      }
    } catch (error) {
      console.error('💥 Reconciliation failed:', error);
      toast.error('Failed to run reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const processStripeOrder = async (sessionId: string, email: string) => {
    setProcessingOrder(sessionId);

    try {
      console.log('🔄 Processing Stripe order:', { sessionId, email });
      
      const { data, error } = await supabase.functions.invoke('process-stripe-success', {
        body: { 
          sessionId,
          planId: 'unknown', // Would need to be determined from session metadata
          paymentType: 'monthly'
        }
      });

      if (error) {
        console.error('❌ Stripe processing error:', error);
        toast.error(`Failed to process Stripe order: ${error.message}`);
      } else {
        console.log('✅ Stripe order processed:', data);
        toast.success('Stripe order processed successfully');
        // Refresh results
        runReconciliation();
      }
    } catch (error) {
      console.error('💥 Stripe processing failed:', error);
      toast.error('Failed to process Stripe order');
    } finally {
      setProcessingOrder(null);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Order Reconciliation
        </CardTitle>
        <CardDescription>
          Check for missed orders from Stripe and Bumper APIs and reconcile with your database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button 
          onClick={runReconciliation} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Reconciliation...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Order Reconciliation
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {results.summary.totalExistingCustomers}
                </div>
                <div className="text-sm text-gray-600">Existing Customers</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {results.summary.potentialMissingStripeOrders}
                </div>
                <div className="text-sm text-gray-600">Missing Stripe</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {results.summary.potentialMissingBumperOrders}
                </div>
                <div className="text-sm text-gray-600">Missing Bumper</div>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {results.summary.totalErrors}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Last checked: {formatDate(results.summary.lastChecked)}
            </div>

            <Separator />

            {/* Stripe Results */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Stripe Analysis
              </h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Total Sessions Found:</span>
                  <Badge variant="secondary">{results.stripeResults.totalSessions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Missing from Database:</span>
                  <Badge variant={results.stripeResults.missingSessions > 0 ? "destructive" : "secondary"}>
                    {results.stripeResults.missingSessions}
                  </Badge>
                </div>
              </div>

              {results.stripeResults.missingSessionIds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-700">Missing Stripe Orders:</h4>
                  {results.stripeResults.missingSessionIds.map((session) => (
                    <div key={session.id} className="border rounded-lg p-3 bg-red-50 border-red-200">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="font-medium">{session.email}</div>
                          <div className="text-sm text-gray-600">
                            Session: {session.id}
                          </div>
                          <div className="text-sm text-gray-600">
                            Amount: {formatAmount(session.amount)} | Created: {formatDate(session.created)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => processStripeOrder(session.id, session.email)}
                          disabled={processingOrder === session.id}
                        >
                          {processingOrder === session.id ? 'Processing...' : 'Process Order'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Bumper Results */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
                Bumper Analysis
              </h3>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="font-medium text-purple-800">
                    {results.bumperResults.note}
                  </div>
                  <div className="text-sm text-purple-600">
                    {results.bumperResults.suggestion}
                  </div>
                </div>
              </div>
            </div>

            {/* Errors */}
            {results.errors.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    Errors ({results.errors.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {results.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-sm text-red-700">{error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderReconciliation;