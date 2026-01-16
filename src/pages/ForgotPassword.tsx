import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Send, Lock, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

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
        title="Reset Password | Customer Login Help"
        description="Reset your customer dashboard password or get your login credentials resent to your email address."
        keywords="forgot password, reset password, customer login, warranty dashboard access"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
        {/* Minimal Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img 
                  src="/lovable-uploads/baw_logo_new_2025_copy_2-2.png" 
                  alt="BuyAWarranty" 
                  className="h-7 sm:h-9 w-auto"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-md">
            {/* Back Link */}
            <Button
              variant="ghost"
              onClick={() => navigate('/customer-dashboard')}
              className="mb-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-0 -ml-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Button>

            <Card className="border-0 shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden">
              <CardHeader className="text-center pb-2 pt-8 px-6 sm:px-8">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-orange-50 to-amber-100 rounded-full flex items-center justify-center mb-5 shadow-sm">
                  {sent ? (
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  ) : (
                    <Mail className="w-7 h-7 text-orange-500" />
                  )}
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {sent ? 'Check Your Email' : 'Need Help Logging In?'}
                </CardTitle>
                <CardDescription className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">
                  {sent 
                    ? 'We\'ve sent your login details. Check your inbox and spam folder.'
                    : 'Enter your email and we\'ll send you your login credentials for the customer dashboard.'
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent className="px-6 sm:px-8 pb-8 pt-6">
                {sent ? (
                  <div className="space-y-5">
                    <Alert className="bg-green-50 border-green-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Login credentials have been sent to <strong>{email}</strong>. 
                        Please check your email and spam folder.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      onClick={() => navigate('/customer-dashboard')}
                      className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base shadow-lg shadow-orange-200/50"
                    >
                      Go to Login
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                      Didn't receive an email?{' '}
                      <Button 
                        variant="link" 
                        className="p-0 h-auto font-medium text-orange-500 hover:text-orange-600"
                        onClick={() => setSent(false)}
                      >
                        Try again
                      </Button>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleResendCredentials} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-11 h-12 rounded-xl border-gray-200 focus:border-orange-300 focus:ring-orange-200 transition-colors"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base shadow-lg shadow-orange-200/50" 
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Login Credentials
                        </>
                      )}
                    </Button>

                    {/* Secure Badge */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
                      <Lock className="w-3 h-3" />
                      <span>Secure Request</span>
                    </div>
                  </form>
                )}
                
                {/* Help Text */}
                {!sent && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="bg-amber-50/70 rounded-xl p-4">
                      <p className="text-sm text-amber-800 text-center leading-relaxed">
                        <span className="font-medium">First time here?</span> Use the temporary password from your welcome email. If you can't find it, enter your email above and we'll resend it.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support Contact */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Need help? Contact us at{' '}
              <a href="mailto:support@buyawarranty.co.uk" className="text-orange-500 hover:text-orange-600 font-medium">
                support@buyawarranty.co.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;