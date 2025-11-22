import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ApiTestResult {
  timestamp: string;
  bumper: { status: string; details: any };
  warranties2000: { status: string; details: any };
  stripe: { status: string; details: any };
  environment: {
    hasStripKey: boolean;
    hasBumperKey: boolean;
    hasBumperSecret: boolean;
    hasWarrantiesUser: boolean;
    hasWarrantiesPass: boolean;
  };
}

export const ApiConnectivityTest = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<ApiTestResult | null>(null);

  const runConnectivityTest = async () => {
    setIsLoading(true);
    try {
      console.log("Starting API connectivity test...");
      
      const { data, error } = await supabase.functions.invoke('test-api-connectivity', {
        body: {}
      });

      if (error) {
        console.error("API test error:", error);
        throw error;
      }

      console.log("API test completed:", data);
      setTestResults(data);
      toast.success('API connectivity test completed');
    } catch (error) {
      console.error("Failed to run API test:", error);
      toast.error('Failed to run connectivity test: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'missing_credentials':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'working':
        return <Badge variant="default" className="bg-green-100 text-green-800">Working</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'missing_credentials':
        return <Badge variant="secondary">Missing Credentials</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            API Connectivity Test
          </CardTitle>
          <CardDescription>
            Test connectivity to all external APIs: Bumper, Warranties 2000, and Stripe.
            This will help diagnose go-live issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runConnectivityTest} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Connectivity Test...
              </>
            ) : (
              'Run API Connectivity Test'
            )}
          </Button>
        </CardContent>
      </Card>

      {testResults && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Environment Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Environment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Stripe Key</span>
                {testResults.environment.hasStripKey ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Bumper Key</span>
                {testResults.environment.hasBumperKey ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Bumper Secret</span>
                {testResults.environment.hasBumperSecret ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Warranties User</span>
                {testResults.environment.hasWarrantiesUser ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Warranties Pass</span>
                {testResults.environment.hasWarrantiesPass ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bumper API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                Bumper API
                {getStatusIcon(testResults.bumper.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getStatusBadge(testResults.bumper.status)}
              {testResults.bumper.details && (
                <div className="text-xs text-muted-foreground">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(testResults.bumper.details, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warranties 2000 API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                Warranties 2000 API
                {getStatusIcon(testResults.warranties2000.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getStatusBadge(testResults.warranties2000.status)}
              {testResults.warranties2000.details && (
                <div className="text-xs text-muted-foreground">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(testResults.warranties2000.details, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stripe API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                Stripe API
                {getStatusIcon(testResults.stripe.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getStatusBadge(testResults.stripe.status)}
              {testResults.stripe.details && (
                <div className="text-xs text-muted-foreground">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(testResults.stripe.details, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Full Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(testResults, null, 2)}
              readOnly
              className="min-h-[200px] font-mono text-xs"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};