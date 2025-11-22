import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const AdminLoginDebug = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('info@buyawarranty.co.uk');
  const [password, setPassword] = useState('h3WfIIijI195');
  const [showPassword, setShowPassword] = useState(false);

  const handleSetPassword = async () => {
    setLoading(true);
    try {
      console.log('Setting password for admin user...');
      
      const { data, error } = await supabase.functions.invoke('set-admin-password', {
        body: {
          userId: 'bc7f1690-2bad-454c-9c9c-700677bb957b',
          email: 'info@buyawarranty.co.uk',
          password: password
        }
      });

      if (error) {
        console.error('Password set error:', error);
        toast({
          title: "Error",
          description: `Failed to set password: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Password set result:', data);
      toast({
        title: "Success",
        description: "Password updated successfully!",
      });
      
    } catch (error: any) {
      console.error('Password set failed:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async () => {
    setLoading(true);
    try {
      console.log('Testing login with credentials...');
      
      // First sign out any existing session
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login test error:', error);
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Login test successful:', data.user?.email);
      
      // Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.session.user.id)
        .maybeSingle();

      console.log('Role check result:', { roleData, roleError });

      toast({
        title: "Login Successful",
        description: `Logged in as ${data.user?.email} with role: ${roleData?.role || 'no role'}`,
      });

      // Navigate to admin dashboard
      if (roleData && ['admin', 'member', 'viewer', 'guest'].includes(roleData.role)) {
        console.log('Navigating to admin dashboard...');
        navigate('/admin-dashboard', { replace: true });
      }
      
    } catch (error: any) {
      console.error('Login test failed:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (session) {
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        console.log('Current user role:', { roleData, error });
        
        toast({
          title: "Current User",
          description: `Logged in as: ${session.user.email}, Role: ${roleData?.role || 'no role'}`,
        });
      } else {
        toast({
          title: "No Session",
          description: "No current user session found",
        });
      }
    } catch (error: any) {
      console.error('Session check failed:', error);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Admin Login Debug Tool</CardTitle>
        <CardDescription>
          Debug and fix admin authentication issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="debug-email">Email</Label>
          <Input
            id="debug-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="debug-password">Password</Label>
          <div className="relative">
            <Input
              id="debug-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleSetPassword}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Setting...' : 'Set Password'}
          </Button>
          
          <Button 
            onClick={handleTestLogin}
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Login & Navigate'}
          </Button>
          
          <Button 
            onClick={handleCheckCurrentUser}
            variant="secondary"
          >
            Check Current User
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminLoginDebug;