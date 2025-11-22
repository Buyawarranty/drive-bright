import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ResendWelcomeEmail = () => {
  const [email, setEmail] = useState('claims@buyawarranty.co.uk');
  const [loading, setLoading] = useState(false);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      console.log('Resending welcome email to:', email);
      
      const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { customerEmail: email }
      });

      if (error) {
        console.error('Error resending welcome email:', error);
        throw error;
      }

      console.log('Welcome email resent successfully:', data);
      toast.success(`Welcome email resent successfully to ${email}`);
      
      if (data.registrationPlate) {
        toast.info(`Registration plate: ${data.registrationPlate}`);
      }
    } catch (error) {
      console.error('Failed to resend welcome email:', error);
      toast.error(`Failed to resend welcome email: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Resend Welcome Email</CardTitle>
        <CardDescription>
          Send a welcome email with registration plate instead of payment type
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="email"
          placeholder="Enter customer email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button 
          onClick={handleResendEmail}
          disabled={loading || !email}
          className="w-full"
        >
          {loading ? 'Sending...' : 'Resend Welcome Email'}
        </Button>
      </CardContent>
    </Card>
  );
};