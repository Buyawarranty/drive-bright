
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PasswordReset = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  
  useEffect(() => {
    const initializePasswordReset = async () => {
      console.log('Initializing password reset...');
      console.log('Current URL:', window.location.href);
      console.log('Hash:', window.location.hash);
      console.log('Search params:', window.location.search);
      
      // First, handle hash-based URL parameters (most common format)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      
      // Then check regular URL parameters as fallback
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
      const type = hashParams.get('type') || searchParams.get('type');
      
      console.log('Password reset tokens found:', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken, 
        type,
        hashParamsSize: Array.from(hashParams.entries()).length,
        searchParamsSize: Array.from(searchParams.entries()).length
      });
      
      if (type === 'recovery' && accessToken && refreshToken) {
        try {
          console.log('Attempting to set session with recovery tokens...');
          
          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Error setting session:', error);
            toast({
              title: "Invalid reset link",
              description: "This password reset link is invalid or has expired. Please request a new one from the sign-in page.",
              variant: "destructive",
            });
            // Redirect after 3 seconds to give user time to read the message
            setTimeout(() => navigate('/auth'), 3000);
          } else if (data.session) {
            console.log('Session set successfully for password reset');
            setIsValidSession(true);
            
            // Clean up the URL by removing the hash parameters
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, cleanUrl);
            
            toast({
              title: "Reset link validated",
              description: "You can now set your new password.",
            });
          }
        } catch (error) {
          console.error('Error in password reset initialization:', error);
          toast({
            title: "Error",
            description: "Failed to initialize password reset. Please try clicking the link from your email again.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/auth'), 3000);
        }
      } else {
        console.log('No valid recovery tokens found, checking for existing session...');
        
        // Check if user is already authenticated (rare but possible)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('User already has valid session');
          setIsValidSession(true);
        } else {
          console.log('No valid session or recovery tokens found');
          toast({
            title: "Reset link required",
            description: "Please click the password reset link from your email to access this page. If you haven't received an email, try requesting a new password reset from the sign-in page.",
            variant: "destructive",
          });
          // Redirect after 5 seconds to give user time to read the message
          setTimeout(() => navigate('/auth'), 5000);
        }
      }
    };

    initializePasswordReset();
  }, [searchParams, navigate, toast]);

  const handlePasswordReset = async () => {
    if (!isValidSession) {
      toast({
        title: "Session expired",
        description: "Please request a new password reset link.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Track that user has reset their password (so they don't get temp passwords in future emails)
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.email) {
          await supabase.functions.invoke('track-password-reset', {
            body: { email: user.user.email }
          });
        }
      } catch (trackError) {
        console.error('Failed to track password reset:', trackError);
        // Don't fail the password reset if tracking fails
      }

      toast({
        title: "Password updated",
        description: "Your password has been successfully updated. You can now access your dashboard.",
      });

      // Check user role and redirect to appropriate dashboard
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (roleData?.role === 'admin') {
          navigate('/admin-dashboard', { replace: true });
        } else {
          navigate('/customer-dashboard', { replace: true });
        }
      } else {
        navigate('/auth', { replace: true });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src="/lovable-uploads/9b53da8c-70f3-4fc2-8497-e1958a650b4a.png" 
              alt="BuyAWarranty" 
              className="h-12 w-auto mx-auto mb-4"
            />
            <CardTitle>Validating Reset Link</CardTitle>
            <CardDescription>
              Please wait while we validate your password reset link...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-gray-600">
            <p>If this takes more than a few seconds, please check that you clicked the correct link from your email.</p>
            <p className="mt-2">If you need to request a new password reset, you can do so from the sign-in page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src="/lovable-uploads/9b53da8c-70f3-4fc2-8497-e1958a650b4a.png" 
            alt="BuyAWarranty" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Create a new password for your BuyAWarranty account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
            />
          </div>
          <Button 
            onClick={handlePasswordReset} 
            disabled={loading || !password || !confirmPassword}
            className="w-full"
          >
            {loading ? 'Updating...' : 'Set Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordReset;
