import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const SetupAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('info@buyawarranty.co.uk');
  const [password, setPassword] = useState('PasswordLogin123-');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSetPassword = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Call edge function to setup admin user
      const { data, error } = await supabase.functions.invoke('setup-admin-user', {
        body: { email, password }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success!",
        description: `Admin user setup complete. You can now login with ${email}. Redirecting...`,
      });

      console.log("Admin setup successful:", data);

      // Redirect to auth page after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error setting up admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to setup admin. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Setup Admin Password</CardTitle>
          <CardDescription>
            Set the password for the admin account
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
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <Button 
            onClick={handleSetPassword} 
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? 'Setting Password...' : 'Set Password & Continue to Login'}
          </Button>
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
            <strong>Current credentials:</strong><br />
            Email: {email}<br />
            Password: {password}
          </div>
          <div className="text-xs text-gray-500 mt-4">
            <strong>Note:</strong> This page should only be used for initial setup. 
            After setting your password, you'll be redirected to the login page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupAdmin;
