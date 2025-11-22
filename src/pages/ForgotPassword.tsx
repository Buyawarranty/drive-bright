import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResendCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: { email }
      });

      if (error) {
        throw error;
      }

      setSent(true);
      toast.success('Login credentials have been sent to your email address');
    } catch (error: any) {
      console.error('Error resending credentials:', error);
      toast.error(error.message || 'Failed to resend login credentials. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Forgot Password | Customer Login Help"
        description="Forgot your customer dashboard password? Get your login credentials resent to your email address."
        keywords="forgot password, customer login, warranty dashboard access"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Forgot Your Password?</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you your login credentials for the customer dashboard.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {sent ? (
                <div className="text-center space-y-4">
                  <Alert>
                    <Send className="h-4 w-4" />
                    <AlertDescription>
                      Login credentials have been sent to <strong>{email}</strong>. 
                      Please check your email and spam folder.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setSent(false);
                        setEmail('');
                      }}
                    >
                      Send to Different Email
                    </Button>
                    
                    <Link to="/customer-dashboard" className="block">
                      <Button className="w-full">
                        Go to Login
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResendCredentials} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Login Credentials
                      </>
                    )}
                  </Button>
                </form>
              )}
              
              <div className="pt-4 border-t">
                <Link to="/customer-dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Login
                </Link>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Need help? Contact us at <a href="mailto:info@buyawarranty.co.uk" className="text-primary hover:underline">info@buyawarranty.co.uk</a></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;