import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SalesLoginGate } from '@/components/auth/SalesLoginGate';
import { useGatewayUnlock } from '@/lib/loginGateway';
import { withTimeout } from '@/lib/withTimeout';
import { logLoginAttempt } from '@/lib/loginActivityLogger';
import { checkLoginLockout, lockoutMessage } from '@/lib/loginLockout';
import { staffDeviceSignIn, staffDeviceRequest } from '@/lib/staffDeviceAccess';

const SalesLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { isUnlocked, setIsUnlocked } = useGatewayUnlock();
  const navigate = useNavigate();
  const { toast } = useToast();


  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 10000, 'Session check');

        if (session?.user) {
          const device = await staffDeviceRequest('request');
          if (!device.allowed) throw new Error('Device approval required');
          const renewal = await withTimeout(supabase.functions.invoke('staff-password', { body: { action: 'status' }, headers: { Authorization: `Bearer ${session.access_token}` } }), 15000, 'Staff access check');
          if (renewal.data?.must_change) { navigate('/staff-password-renewal/', { replace: true }); return; }
          // Check if user has sales or admin role
          const { data: roles } = await withTimeout(
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id),
            10000,
            'Role check'
          );

          const userRoles = roles?.map(r => r.role) || [];

          const staffRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts', 'claims_agent', 'claims_manager', 'performance_manager', 'sales_manager'];
          if (userRoles.some(r => staffRoles.includes(r))) {
            navigate('/admin-dashboard/', { replace: true });
            return;
          }
        }
      } catch (error) {
        // Never strand the page on the spinner — fall through to the login form.
        console.error('Session check failed:', error);
      } finally {
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Brute-force protection: block before even attempting when locked.
      const preLock = await checkLoginLockout(normalizedEmail);
      if (preLock.locked) {
        throw new Error(lockoutMessage(preLock.retryAfterSeconds));
      }

      // Sign in with email and password
      const { data: authData, error: authError } = await staffDeviceSignIn(normalizedEmail, password);

      if (authError) {
        logLoginAttempt({
          email: normalizedEmail,
          event_type: 'login_failed',
          success: false,
          failure_reason: authError.message,
        });
        const postLock = await checkLoginLockout(normalizedEmail);
        throw new Error(postLock.locked ? lockoutMessage(postLock.retryAfterSeconds) : authError.message);
      }

      if (!authData.user) {
        throw new Error('Login failed. Please try again.');
      }

      const renewal = await withTimeout(supabase.functions.invoke('staff-password', { body: { action: 'status' }, headers: { Authorization: `Bearer ${authData.session?.access_token ?? ''}` } }), 15000, 'Staff access check');
      if (renewal.error || renewal.data?.error) throw new Error('Unable to check staff password renewal. Please try again.');
      if (renewal.data?.must_change) { navigate('/staff-password-renewal/', { replace: true }); return; }

      // Check if user has sales, admin, or member role
      let rolesResult: { data: { role: string }[] | null; error: any } | null = null;
      for (let attempt = 0; attempt < 3 && !rolesResult; attempt++) {
        try {
          rolesResult = await withTimeout(
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', authData.user.id),
            12000,
            'Role check'
          );
        } catch (roleErr) {
          console.error(`Role check attempt ${attempt + 1} failed:`, roleErr);
          await new Promise(r => setTimeout(r, 800));
        }
      }
      if (!rolesResult) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('Signed in, but verifying your access timed out — please try again.');
      }
      const { data: roles, error: rolesError } = rolesResult;

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        throw new Error('Unable to verify your access. Please contact support.');
      }

      let userRoles = roles?.map(r => r.role) || [];
      const staffRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts', 'claims_agent', 'claims_manager', 'performance_manager', 'sales_manager'];

      // An empty result can mean the role read went out before the fresh
      // session token was attached (e.g. another tab refreshing the same
      // shared account). Retry once with the session we just received.
      if (!userRoles.some(r => staffRoles.includes(r)) && authData.session) {
        try {
          await supabase.auth.setSession({ access_token: authData.session.access_token, refresh_token: authData.session.refresh_token });
          const retry = await withTimeout(
            supabase.from('user_roles').select('role').eq('user_id', authData.user.id),
            10000,
            'Role re-check'
          );
          userRoles = retry.data?.map(r => r.role) || [];
        } catch (retryErr) {
          console.error('Role re-check failed:', retryErr);
        }
      }
      const hasAccess = userRoles.some(r => staffRoles.includes(r));

      if (!hasAccess) {
        // Sign out the user since they don't have sales access
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('Access denied. This login is for sales team members only.');
      }

      // Block deactivated accounts and expired temporary logins.
      // Non-blocking: if this secondary check errors or times out, a user who
      // already holds a valid staff role is still allowed through.
      let adminRow: any = null;
      try {
        const { data } = await withTimeout(
          supabase
            .from('admin_users')
            .select('is_active, access_expires_at')
            .eq('user_id', authData.user.id)
            .maybeSingle(),
          10000,
          'Account status check'
        );
        adminRow = data;
      } catch (statusErr) {
        console.error('Account status check failed (continuing):', statusErr);
      }

      const expired = !!(adminRow as any)?.access_expires_at
        && new Date((adminRow as any).access_expires_at).getTime() < Date.now();

      if (adminRow && ((adminRow as any).is_active === false || expired)) {
        if (expired) {
          await supabase.from('admin_users').update({ is_active: false }).eq('user_id', authData.user.id);
        }
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(expired
          ? 'This temporary login has expired. Ask a manager to extend it.'
          : 'This login has been deactivated. Please contact a manager.');
      }

      // Update last_login in admin_users
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', authData.user.id);

      logLoginAttempt({
        email: normalizedEmail,
        event_type: 'login_success',
        success: true,
      });

      toast({
        title: "Welcome back!",
        description: "Redirecting to your dashboard...",
      });

      // Redirect to admin dashboard
      navigate('/admin-dashboard/', { replace: true });

    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || 'Invalid email or password.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isUnlocked) {
    return <SalesLoginGate onUnlock={() => setIsUnlocked(true)} />;
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-brand-orange/10 rounded-full flex items-center justify-center mb-4">
            <LogIn className="h-8 w-8 text-brand-orange" />
          </div>
          <CardTitle className="text-xl md:text-2xl">Sales Team Login</CardTitle>
          <CardDescription className="text-sm">
            Enter your credentials to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-brand-orange hover:bg-orange-600"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-2">
            <a 
              href="/forgot-password/" 
              className="text-sm text-brand-orange hover:underline block"
            >
              Forgot your password?
            </a>
            <a 
              href="/" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors block"
            >
              ← Back to Homepage
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesLogin;
