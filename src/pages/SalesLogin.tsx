import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SalesLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if user has sales or admin role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        
        const userRoles = roles?.map(r => r.role) || [];
        
        const staffRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts'];
        if (userRoles.some(r => staffRoles.includes(r))) {
          navigate('/admin-dashboard/', { replace: true });
          return;
        }
      }
      
      setCheckingSession(false);
    };
    
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Login failed. Please try again.');
      }

      // Check if user has sales, admin, or member role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        throw new Error('Unable to verify your access. Please contact support.');
      }

      const userRoles = roles?.map(r => r.role) || [];
      const staffRoles = ['super_admin', 'admin', 'member', 'viewer', 'guest', 'sales', 'sales_lead', 'blog_writer', 'dev_tester', 'accounts_manager', 'accounts_payroll', 'lead_gen', 'accounts'];
      const hasAccess = userRoles.some(r => staffRoles.includes(r));

      if (!hasAccess) {
        // Sign out the user since they don't have sales access
        await supabase.auth.signOut();
        throw new Error('Access denied. This login is for sales team members only.');
      }

      // Update last_login in admin_users
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', authData.user.id);

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
