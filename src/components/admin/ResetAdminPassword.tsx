import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ResetAdminPassword = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('info@buyawarranty.co.uk');
  const { toast } = useToast();

  const resetPassword = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
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
        .single();

      if (!adminData) {
        toast({
          title: "Error",
          description: "Admin user not found",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('reset-admin-password', {
        body: {
          userId: adminData.user_id,
          email: email
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Password Reset",
        description: `Temporary password: ${data.temporaryPassword}. Email sent to ${email}`,
      });

      console.log("New temporary password:", data.temporaryPassword);
      
    } catch (error: any) {
      console.error('Error resetting password:', error);
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
    <Card>
      <CardHeader>
        <CardTitle>Reset Admin Password</CardTitle>
        <CardDescription>
          Reset password for an admin user and send new credentials via email
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
        <Button 
          onClick={resetPassword} 
          disabled={loading || !email}
          className="w-full"
        >
          {loading ? 'Resetting...' : 'Reset Password & Send Email'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ResetAdminPassword;