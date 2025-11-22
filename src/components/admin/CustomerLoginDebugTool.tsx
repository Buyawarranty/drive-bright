import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, RefreshCw, LogIn, UserCheck, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CustomerLoginDebugTool = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [registrationPlate, setRegistrationPlate] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any>(null);

  const generateRandomPassword = () => {
    const length = 8;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleTestLogin = async () => {
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Testing customer login...');
      
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
        setCustomerInfo(null);
        return;
      }

      console.log('Login test successful:', data.user?.email);
      
      // Fetch customer policies
      const { data: policies, error: policiesError } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', email);

      console.log('Policies:', { policies, policiesError });

      setCustomerInfo({
        email: data.user?.email,
        userId: data.user?.id,
        policiesCount: policies?.length || 0,
        policies: policies || []
      });

      toast({
        title: "Login Successful ✅",
        description: `Logged in as ${data.user?.email}. Found ${policies?.length || 0} policies.`,
      });

      // Sign out after test
      await supabase.auth.signOut();
      
    } catch (error: any) {
      console.error('Login test failed:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNewPassword = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter customer email first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate new random password
      const tempPassword = generateRandomPassword();
      setNewPassword(tempPassword);

      console.log('Generating new password for customer:', email);
      
      // Call the reset password function
      const { data, error } = await supabase.functions.invoke('reset-customer-password', {
        body: {
          email: email,
          newPassword: tempPassword
        }
      });

      if (error) {
        console.error('Password reset error:', error);
        toast({
          title: "Password Reset Failed",
          description: error.message || "Failed to reset password",
          variant: "destructive",
        });
        setNewPassword('');
        return;
      }

      console.log('Password reset result:', data);
      
      // Immediately test the new password
      console.log('Testing new password...');
      await supabase.auth.signOut();
      
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: tempPassword,
      });

      if (loginError) {
        toast({
          title: "Password Set But Login Failed",
          description: "Password was set but test login failed. Please try again.",
          variant: "destructive",
        });
        console.error('New password test failed:', loginError);
      } else {
        toast({
          title: "✅ Password Reset Successful",
          description: `New password set and verified. Customer can now login.`,
        });
        console.log('New password verified successfully');
        
        // Fetch policies after successful login
        const { data: policies } = await supabase
          .from('customer_policies')
          .select('*')
          .ilike('email', email);

        setCustomerInfo({
          email: loginData.user?.email,
          userId: loginData.user?.id,
          policiesCount: policies?.length || 0,
          policies: policies || []
        });
      }

      // Sign out after test
      await supabase.auth.signOut();
      
    } catch (error: any) {
      console.error('Password generation failed:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setNewPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCustomer = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter customer email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Checking customer info for:', email);
      
      const { data: policies, error } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', email);

      if (error) throw error;

      setCustomerInfo({
        email: email,
        userId: null,
        policiesCount: policies?.length || 0,
        policies: policies || []
      });

      toast({
        title: "Customer Info",
        description: `Found ${policies?.length || 0} policies for ${email}`,
      });
      
    } catch (error: any) {
      console.error('Customer check failed:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCustomer = async () => {
    if (!email && !registrationPlate) {
      toast({
        title: "Search Required",
        description: "Please enter email address or registration plate",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearchResults(null);
    
    try {
      console.log('Searching for customer by:', { email, registrationPlate });
      
      // Search in customers table
      let customerQuery = supabase.from('customers').select('*');
      
      if (email) {
        customerQuery = customerQuery.ilike('email', email);
      } else if (registrationPlate) {
        customerQuery = customerQuery.ilike('registration_plate', registrationPlate.replace(/\s/g, ''));
      }

      const { data: customers, error: customerError } = await customerQuery;
      
      if (customerError) throw customerError;

      if (!customers || customers.length === 0) {
        // Try searching in policies table
        let policyQuery = supabase.from('customer_policies').select('*');
        
        if (email) {
          policyQuery = policyQuery.ilike('email', email);
        }

        const { data: policies, error: policyError } = await policyQuery;
        
        if (policyError) throw policyError;

        if (!policies || policies.length === 0) {
          toast({
            title: "Not Found",
            description: "No customer found with this email or registration plate",
            variant: "destructive",
          });
          return;
        }

        // Found in policies, use that email
        const foundEmail = policies[0].email;
        setEmail(foundEmail);

        // Search for welcome email with credentials
        const { data: welcomeEmails } = await supabase
          .from('welcome_emails')
          .select('*')
          .ilike('customer_email', foundEmail)
          .order('sent_at', { ascending: false })
          .limit(1);

        setSearchResults({
          foundIn: 'policies',
          email: foundEmail,
          customer: null,
          policies: policies,
          credentials: welcomeEmails?.[0] || null
        });

        toast({
          title: "Customer Found",
          description: `Found ${policies.length} policy(ies) for ${foundEmail}`,
        });

        return;
      }

      // Found in customers table
      const customer = customers[0];
      const foundEmail = customer.email;
      setEmail(foundEmail);

      // Get policies
      const { data: policies } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', foundEmail);

      // Get welcome email credentials
      const { data: welcomeEmails } = await supabase
        .from('welcome_emails')
        .select('*')
        .ilike('customer_email', foundEmail)
        .order('sent_at', { ascending: false })
        .limit(1);

      setSearchResults({
        foundIn: 'customers',
        email: foundEmail,
        customer: customer,
        policies: policies || [],
        credentials: welcomeEmails?.[0] || null
      });

      toast({
        title: "Customer Found ✅",
        description: `Found customer: ${customer.name || foundEmail}`,
      });
      
    } catch (error: any) {
      console.error('Search failed:', error);
      toast({
        title: "Search Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Customer Login Debug Tool</CardTitle>
        <CardDescription>
          Test customer credentials and reset passwords
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="font-semibold text-blue-900">🔍 Search Customer</div>
          <div>
            <Label htmlFor="search-email">Email Address</Label>
            <Input
              id="search-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          
          <div className="text-center text-sm text-blue-700 font-medium">OR</div>
          
          <div>
            <Label htmlFor="search-reg">Registration Plate</Label>
            <Input
              id="search-reg"
              type="text"
              value={registrationPlate}
              onChange={(e) => setRegistrationPlate(e.target.value.toUpperCase())}
              placeholder="AB12 CDE"
              className="uppercase"
            />
          </div>

          <Button 
            onClick={handleSearchCustomer}
            disabled={loading || (!email && !registrationPlate)}
            className="w-full"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            {loading ? 'Searching...' : 'Search Customer'}
          </Button>
        </div>

        {searchResults && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="space-y-2 text-sm">
              <div className="font-semibold text-green-900">✅ Customer Found</div>
              <div className="space-y-1">
                <div><strong>Email:</strong> {searchResults.email}</div>
                {searchResults.customer && (
                  <>
                    <div><strong>Name:</strong> {searchResults.customer.name}</div>
                    <div><strong>Registration:</strong> {searchResults.customer.registration_plate || 'N/A'}</div>
                    <div><strong>Plan:</strong> {searchResults.customer.plan_type}</div>
                  </>
                )}
                <div><strong>Policies:</strong> {searchResults.policies?.length || 0}</div>
                {searchResults.credentials?.temporary_password && (
                  <div className="mt-3 p-3 bg-white rounded border border-green-300">
                    <div className="font-semibold text-green-900 mb-1">🔑 Login Credentials</div>
                    <div><strong>Email:</strong> {searchResults.email}</div>
                    <div className="font-mono text-lg mt-1">
                      <strong>Password:</strong> {searchResults.credentials.temporary_password}
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      Last sent: {new Date(searchResults.credentials.sent_at).toLocaleString()}
                    </div>
                  </div>
                )}
                {!searchResults.credentials?.temporary_password && (
                  <div className="text-orange-700 text-xs mt-2">
                    ⚠️ No password found in system. Use "Generate New Password" below.
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <div className="font-semibold text-sm mb-3">🔧 Test & Reset Tools</div>
          <div>
            <Label htmlFor="customer-email">Customer Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="customer-password">Password (for testing)</Label>
          <div className="relative">
            <Input
              id="customer-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to test"
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

        {newPassword && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="space-y-2">
              <div className="font-semibold text-green-900">✅ New Password Generated & Verified:</div>
              <div className="font-mono text-lg bg-white p-2 rounded border border-green-300 text-green-900">
                {newPassword}
              </div>
              <div className="text-sm text-green-700">
                This password has been set and verified. Customer can login immediately.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {customerInfo && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="space-y-1 text-sm">
              <div><strong>Email:</strong> {customerInfo.email}</div>
              {customerInfo.userId && <div><strong>User ID:</strong> {customerInfo.userId}</div>}
              <div><strong>Policies:</strong> {customerInfo.policiesCount}</div>
              {customerInfo.policies.length > 0 && (
                <div className="mt-2 space-y-1">
                  {customerInfo.policies.map((policy: any) => (
                    <div key={policy.id} className="text-xs bg-white p-2 rounded">
                      <div><strong>Policy:</strong> {policy.policy_number}</div>
                      <div><strong>Plan:</strong> {policy.plan_type}</div>
                      <div><strong>Status:</strong> {policy.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleTestLogin}
            disabled={loading || !email || !password}
            variant="default"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? 'Testing...' : 'Test Login'}
          </Button>
          
          <Button 
            onClick={handleGenerateNewPassword}
            disabled={loading || !email}
            variant="outline"
            className="bg-orange-50 border-orange-300 hover:bg-orange-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? 'Generating...' : 'Generate New Password'}
          </Button>
          
          <Button 
            onClick={handleCheckCustomer}
            disabled={loading || !email}
            variant="secondary"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Check Customer Info
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerLoginDebugTool;
