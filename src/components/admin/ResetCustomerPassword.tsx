import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const ResetCustomerPassword = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    toast({
      title: "Password Generated",
      description: "Review and test the password before resetting",
    });
  };

  const copyToClipboard = async () => {
    if (!newPassword) return;
    
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive"
      });
    }
  };

  const handleResetPassword = async () => {
    if (!email || !newPassword) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and new password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Call the reset-customer-password edge function
      const { data, error } = await supabase.functions.invoke('reset-customer-password', {
        body: { email, newPassword }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      // Update welcome_emails table with new password
      const { data: welcomeData, error: welcomeError } = await supabase
        .from('welcome_emails')
        .upsert({
          email: email,
          temporary_password: newPassword,
          password_reset: false,
          password_reset_by_user: false,
          email_sent_at: new Date().toISOString()
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        });

      if (welcomeError) {
        console.error('Failed to update welcome_emails:', welcomeError);
      }

      toast({
        title: "Password Reset Successful",
        description: `Password has been reset for ${email}`,
        duration: 10000
      });

      // Clear form
      setEmail('');
      setNewPassword('');
      setCopied(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to reset customer password',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCredentials = async () => {
    if (!email) {
      toast({
        title: "Missing Email",
        description: "Please provide customer email",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: { email }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to resend credentials');
      }

      toast({
        title: "Credentials Sent",
        description: `Login credentials have been sent to ${email}`,
      });
    } catch (error: any) {
      console.error('Error resending credentials:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to resend credentials',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Customer Password</CardTitle>
        <CardDescription>
          Reset password for a customer and optionally send them their credentials via email
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
        
        <div>
          <Label htmlFor="password">New Password</Label>
          <div className="flex gap-2">
            <Input
              id="password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter or generate a password"
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={generateRandomPassword}
            >
              Generate
            </Button>
          </div>
        </div>

        {newPassword && (
          <Alert className="bg-muted">
            <AlertDescription className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Generated Password (Test Before Resetting):</p>
                <div className="flex items-center gap-2 p-3 bg-background rounded-md border">
                  <code className="flex-1 text-lg font-mono font-semibold">
                    {newPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Copy this password and test it manually before clicking "Reset Password"
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleResetPassword}
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
          
          <Button 
            onClick={handleResendCredentials}
            disabled={loading}
            variant="secondary"
          >
            {loading ? 'Sending...' : 'Resend Existing Credentials'}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground border-t pt-4">
          <p className="font-semibold mb-2">How to use:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Generate or enter a password and copy it</li>
            <li>Test the password by logging in manually first</li>
            <li>Once confirmed working, click "Reset Password" to apply</li>
            <li>"Resend Existing Credentials" emails the current stored password</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
