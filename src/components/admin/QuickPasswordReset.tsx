import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const QuickPasswordReset = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('sarabsingh@live.co.uk');
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const { toast } = useToast();

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const resetPassword = async () => {
    setLoading(true);
    const newPassword = generateRandomPassword();
    
    try {
      const { data, error } = await supabase.functions.invoke('reset-customer-password', {
        body: { email, newPassword }
      });
      
      if (error) throw error;
      
      setCredentials({ email, password: newPassword });
      
      toast({
        title: "Password Reset Successful",
        description: "Temporary credentials generated below",
      });
      
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Quick Password Reset</CardTitle>
        <CardDescription>
          Reset customer password and get temporary credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="email">Customer Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
          />
        </div>
        
        <Button 
          onClick={resetPassword} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Resetting...' : 'Reset Password & Get Credentials'}
        </Button>

        {credentials && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-lg">Temporary Credentials:</h3>
            <div className="space-y-1 font-mono text-sm">
              <p><strong>Email:</strong> {credentials.email}</p>
              <p><strong>Password:</strong> {credentials.password}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Test these credentials before sending to the customer
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickPasswordReset;
