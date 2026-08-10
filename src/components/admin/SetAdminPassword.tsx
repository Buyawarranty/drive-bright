import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SetAdminPassword = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('info@buyawarranty.co.uk');
  // Starts blank on purpose: a pre-filled value looks live before it is saved.
  const [passwordValue, setPasswordValue] = useState('');
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSetPassword = async () => {
    if (!email || !passwordValue) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get the user by email
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();

      if (!adminData) {
        toast({
          title: "Error",
          description: "Admin user not found",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('set-admin-password', {
        body: {
          userId: adminData.user_id,
          email: email,
          password: passwordValue
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.verified) {
        throw new Error(data?.error || 'The password could not be verified on the login server. Do not share it — try again.');
      }

      setSavedPassword(passwordValue);
      toast({
        title: "Password saved and verified",
        description: `${email} can now sign in with this password.`,
      });

      console.log("Password set successfully for:", email);
      
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to set password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Admin Password</CardTitle>
        <CardDescription>
          Set a specific password for an admin user
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="email">Admin Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter admin email"
          />
        </div>
        <div>
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Enter new password"
          />
        </div>
        <Button 
          onClick={handleSetPassword} 
          disabled={loading || !email || !passwordValue}
          className="w-full"
        >
          {loading ? 'Saving and verifying...' : 'Save password'}
        </Button>
        {savedPassword ? (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            <strong>Verified credentials (safe to share):</strong><br />
            Email: {email}<br />
            Password: {savedPassword}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            Enter a password and press Save. Nothing is shareable until the server confirms the
            password signs in.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SetAdminPassword;