import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';
import { DealerPublicHeader } from '@/components/dealer/DealerPublicHeader';

const DealerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUnconfirmedEmail(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          setUnconfirmedEmail(email);
          toast({
            title: 'Email not confirmed',
            description: 'Please click the confirmation link we emailed you, then sign in.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      const { data: dealer } = await supabase.from('dealers').select('id').limit(1).maybeSingle();
      if (!dealer) {
        await supabase.auth.signOut();
        toast({ title: 'Access denied', description: 'No dealer account found for this email.', variant: 'destructive' });
        return;
      }

      const redirect = searchParams.get('redirect');
      const reg = searchParams.get('reg') || localStorage.getItem('dealerPendingReg');
      if (redirect) {
        const target = reg ? `${redirect}?reg=${encodeURIComponent(reg)}` : redirect;
        navigate(target);
      } else {
        navigate('/dealer-portal/dashboard');
      }
    } catch (error: any) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/dealer-portal/login` },
    });
    if (error) {
      toast({ title: 'Could not resend', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Confirmation email sent', description: 'Check your inbox (and spam folder).' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <DealerPublicHeader />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
      <SEOHead title="Dealer Login | BuyAWarranty" description="Sign in to your dealer portal." />
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader className="text-center">
          <Link to="/dealer-portal/" className="inline-block mb-4">
            <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-8 mx-auto brightness-0 invert" />
          </Link>
          <span className="inline-block text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded mb-2">DEALER PORTAL</span>
          <CardTitle className="text-2xl font-bold text-white">Dealer Login</CardTitle>
          <CardDescription className="text-gray-400">Sign in to your dealer portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dealer@example.com" required className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
            {unconfirmedEmail && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                <p className="mb-2">Your email <strong>{unconfirmedEmail}</strong> hasn't been confirmed yet. Check your inbox for the confirmation link.</p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  className="font-medium text-amber-100 underline hover:text-white"
                >
                  Resend confirmation email
                </button>
              </div>
            )}
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="text-center mt-4">
            <Link to="/forgot-password/" className="text-sm text-orange-400 hover:underline">Forgot password?</Link>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/dealer-portal/signup" className="text-orange-400 hover:underline font-medium">Create one</Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default DealerLogin;
