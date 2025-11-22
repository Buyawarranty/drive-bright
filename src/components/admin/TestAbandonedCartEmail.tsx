import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TestAbandonedCartEmail = () => {
  const [email, setEmail] = useState('test@example.com');
  const [firstName, setFirstName] = useState('Test');
  const [vehicleReg, setVehicleReg] = useState('TEST123');
  const [vehicleMake, setVehicleMake] = useState('JAGUAR');
  const [vehicleModel, setVehicleModel] = useState('E-PACE');
  const [triggerType, setTriggerType] = useState<'pricing_page_view' | 'plan_selected'>('pricing_page_view');
  const [planName, setPlanName] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSendManual = async () => {
    if (!email || !firstName) {
      toast({
        title: "Missing Information",
        description: "Email and First Name are required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: {
          email,
          firstName,
          vehicleReg,
          vehicleMake,
          vehicleModel,
          triggerType,
          planName: planName || null,
          paymentType: paymentType || null
        }
      });

      if (error) {
        setResult({
          success: false,
          error: error.message
        });

        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setResult({
          success: true,
          data: data,
          message: 'Abandoned cart email sent successfully'
        });

        toast({
          title: "Success",
          description: "Abandoned cart email sent successfully"
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Error",
        description: "Failed to send abandoned cart email",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Test Abandoned Cart Email
        </CardTitle>
        <CardDescription>
          Manually send abandoned cart recovery emails to test the integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">First Name *</label>
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Vehicle Reg</label>
            <Input
              type="text"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
              placeholder="AB12 CDE"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Make</label>
            <Input
              type="text"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
              placeholder="JAGUAR"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Input
              type="text"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              placeholder="E-PACE"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Trigger Type *</label>
          <Select value={triggerType} onValueChange={(value: any) => setTriggerType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pricing_page_view">Pricing Page View (30min delay)</SelectItem>
              <SelectItem value="plan_selected">Plan Selected (60min delay)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Different triggers send different email templates
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan Name (Optional)</label>
            <Input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Basic Plan"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Type (Optional)</label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="twoYear">Two Year</SelectItem>
                <SelectItem value="threeYear">Three Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleSendManual} 
          disabled={isLoading || !email || !firstName}
          className="w-full"
        >
          {isLoading ? 'Sending...' : 'Send Abandoned Cart Email'}
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
                      <p className="font-medium text-green-800">{result.message}</p>
                      {result.data?.emailId && (
                        <p className="text-sm text-green-700">
                          Email ID: {result.data.emailId}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-red-800">Failed to send email</p>
                      <p className="text-sm text-red-700">{result.error}</p>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How It Works:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Sends email immediately (bypasses normal delay)</li>
            <li>• Uses active email templates from database</li>
            <li>• Checks for duplicate emails in last 24 hours</li>
            <li>• Logs all sent emails in triggered_emails_log table</li>
            <li>• Real emails are sent via Resend API</li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-900 mb-2">Automated System:</h4>
          <p className="text-sm text-amber-800">
            The automated abandoned cart email system runs every 30 minutes via cron job. 
            It processes carts from the abandoned_carts table and sends emails based on 
            configured delays (30min for pricing page view, 60min for plan selected).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
