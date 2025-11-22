import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendTrustpilotInvitation } from '@/utils/trustpilotInvite';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TestTrustpilotEmail = () => {
  const [recipientEmail, setRecipientEmail] = useState('test@example.com');
  const [recipientName, setRecipientName] = useState('Test Customer');
  const [referenceId, setReferenceId] = useState('TEST-' + Date.now());
  const [productName, setProductName] = useState('Basic Warranty Plan');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSendManual = () => {
    if (!recipientEmail || !recipientName || !referenceId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      sendTrustpilotInvitation({
        recipientEmail,
        recipientName,
        referenceId,
        orderDate: new Date().toISOString(),
        productName,
        productUrl: 'https://buyawarranty.co.uk'
      });

      setResult({
        success: true,
        message: 'Trustpilot invitation sent successfully'
      });

      toast({
        title: "Success",
        description: "Trustpilot invitation sent successfully"
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Error",
        description: "Failed to send Trustpilot invitation",
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
          <Mail className="h-5 w-5" />
          Test Trustpilot Email Integration
        </CardTitle>
        <CardDescription>
          Manually send Trustpilot review invitations to test the integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Email *</label>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Name *</label>
          <Input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="John Doe"
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Reference ID *</label>
          <Input
            type="text"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="POL-12345"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Unique identifier for the purchase (e.g., policy number)
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Product Name</label>
          <Input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Basic Warranty Plan"
            className="w-full"
          />
        </div>

        <Button 
          onClick={handleSendManual} 
          disabled={isLoading || !recipientEmail || !recipientName || !referenceId}
          className="w-full"
        >
          {isLoading ? 'Sending...' : 'Send Trustpilot Invitation'}
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
                      <p className="text-sm text-green-700">
                        Check browser console for detailed logs
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-red-800">Failed to send invitation</p>
                      <p className="text-sm text-red-700">{result.error}</p>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Trustpilot SDK must be loaded on the page</li>
            <li>• Check browser console for SDK status</li>
            <li>• Invitations are sent via Trustpilot's API</li>
            <li>• Use test email addresses for testing</li>
            <li>• Real invitations will be sent to the email provided</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
