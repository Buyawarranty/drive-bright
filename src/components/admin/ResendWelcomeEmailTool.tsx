import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail } from 'lucide-react';

export const ResendWelcomeEmailTool = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleResendEmail = async () => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { customerEmail: email.trim() }
      });
      
      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult({ success: true, data });
      }
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Resend Welcome Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter customer email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleResendEmail}
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Resend Email'
            )}
          </Button>
        </div>
        
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <AlertDescription>
              {result.success ? (
                <div>
                  <strong>Success!</strong> Welcome email sent successfully.
                  {result.data && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div>
                  <strong>Error:</strong> {result.error}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};