import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Eye, EyeOff, RefreshCw, LogIn, UserCheck, Search, 
  Send, Save, User, Mail, Phone, MapPin, Accessibility, 
  KeyRound, CheckCircle, AlertCircle, Loader2, Copy
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface CustomerData {
  id: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  registration_plate?: string;
  plan_type?: string;
  postcode?: string;
  street?: string;
  town?: string;
  county?: string;
  building_number?: string;
  building_name?: string;
  flat_number?: string;
}

interface PolicyData {
  id: string;
  policy_number: string;
  plan_type: string;
  status: string;
  policy_start_date: string;
  policy_end_date: string;
}

const CustomerLoginsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  
  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchRegPlate, setSearchRegPlate] = useState('');
  
  // Customer data state
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [hasAuthAccount, setHasAuthAccount] = useState<boolean | null>(null);
  
  // Editable fields
  const [editName, setEditName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editTown, setEditTown] = useState('');
  const [editCounty, setEditCounty] = useState('');
  const [editPostcode, setEditPostcode] = useState('');
  const [editBuildingNumber, setEditBuildingNumber] = useState('');
  const [editBuildingName, setEditBuildingName] = useState('');
  const [editFlatNumber, setEditFlatNumber] = useState('');
  
  // Password/credentials state
  const [testPassword, setTestPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loginTestResult, setLoginTestResult] = useState<'success' | 'failed' | null>(null);

  const generateRandomPassword = () => {
    const length = 8;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleSearch = async () => {
    if (!searchEmail && !searchRegPlate) {
      toast({
        title: "Search Required",
        description: "Please enter an email address or registration plate",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setCustomer(null);
    setPolicies([]);
    setHasAuthAccount(null);
    setGeneratedPassword('');
    setLoginTestResult(null);

    try {
      let query = supabase.from('customers').select('*');
      
      if (searchEmail) {
        query = query.ilike('email', `%${searchEmail}%`);
      } else if (searchRegPlate) {
        query = query.ilike('registration_plate', `%${searchRegPlate.replace(/\s/g, '')}%`);
      }

      const { data: customers, error } = await query.limit(1);

      if (error) throw error;

      if (!customers || customers.length === 0) {
        toast({
          title: "Customer Not Found",
          description: "No customer found with those details",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const foundCustomer = customers[0];
      setCustomer(foundCustomer);
      
      // Populate edit fields
      setEditName(foundCustomer.name || '');
      setEditFirstName(foundCustomer.first_name || '');
      setEditLastName(foundCustomer.last_name || '');
      setEditPhone(foundCustomer.phone || '');
      setEditStreet(foundCustomer.street || '');
      setEditTown(foundCustomer.town || '');
      setEditCounty(foundCustomer.county || '');
      setEditPostcode(foundCustomer.postcode || '');
      setEditBuildingNumber(foundCustomer.building_number || '');
      setEditBuildingName(foundCustomer.building_name || '');
      setEditFlatNumber(foundCustomer.flat_number || '');

      // Get policies
      const { data: policyData } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', foundCustomer.email);

      setPolicies(policyData || []);

      // Check if auth account exists
      const { data: checkData } = await supabase.functions.invoke('check-customer-auth', {
        body: { email: foundCustomer.email }
      });

      setHasAuthAccount(checkData?.exists || false);

      toast({
        title: "Customer Found",
        description: `${foundCustomer.name} - ${foundCustomer.email}`,
      });

    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search for customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!customer) return;

    setSavingDetails(true);
    try {
      // Update customer record
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: editName,
          first_name: editFirstName,
          last_name: editLastName,
          phone: editPhone,
          street: editStreet,
          town: editTown,
          county: editCounty,
          postcode: editPostcode,
          building_number: editBuildingNumber,
          building_name: editBuildingName,
          flat_number: editFlatNumber,
        })
        .eq('id', customer.id);

      if (customerError) throw customerError;

      // Also update policies with same email
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          customer_full_name: editName,
          address: {
            street: editStreet,
            town: editTown,
            county: editCounty,
            postcode: editPostcode,
            building_number: editBuildingNumber,
            building_name: editBuildingName,
            flat_number: editFlatNumber
          }
        })
        .ilike('email', customer.email);

      if (policyError) {
        console.error('Policy update warning:', policyError);
      }

      toast({
        title: "✅ Details Saved",
        description: "Customer details updated successfully. Dashboard will reflect changes.",
      });

      // Update local state
      setCustomer({
        ...customer,
        name: editName,
        first_name: editFirstName,
        last_name: editLastName,
        phone: editPhone,
        street: editStreet,
        town: editTown,
        county: editCounty,
        postcode: editPostcode,
        building_number: editBuildingNumber,
        building_name: editBuildingName,
        flat_number: editFlatNumber,
      });

    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save customer details",
        variant: "destructive",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleTestLogin = async () => {
    if (!customer || !testPassword) {
      toast({
        title: "Missing Information",
        description: "Please enter a password to test",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setLoginTestResult(null);

    try {
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: customer.email,
        password: testPassword,
      });

      if (error) {
        setLoginTestResult('failed');
        toast({
          title: "Login Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setLoginTestResult('success');
        toast({
          title: "✅ Login Test Successful",
          description: "Customer can log in with these credentials",
        });
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      setLoginTestResult('failed');
      toast({
        title: "Login Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassword = async () => {
    if (!customer) return;

    setLoading(true);
    try {
      const newPassword = generateRandomPassword();
      
      // First try reset, then create if not found
      const { data: resetData, error: resetError } = await supabase.functions.invoke('reset-customer-password', {
        body: { email: customer.email, newPassword: newPassword }
      });

      if (resetError || (resetData && !resetData.success && resetData.error === 'User not found')) {
        // Create new account
        const { data: createData, error: createError } = await supabase.functions.invoke('create-customer-account', {
          body: {
            email: customer.email,
            password: newPassword,
            firstName: editFirstName || editName?.split(' ')[0] || '',
            lastName: editLastName || editName?.split(' ').slice(1).join(' ') || '',
            customerId: customer.id
          }
        });

        if (createError) throw createError;
        
        toast({
          title: "✅ Account Created",
          description: "New customer account created with password",
        });
      } else {
        toast({
          title: "✅ Password Updated",
          description: "Password has been reset successfully",
        });
      }

      setGeneratedPassword(newPassword);
      setTestPassword(newPassword);
      setHasAuthAccount(true);

    } catch (error: any) {
      console.error('Password generation error:', error);
      toast({
        title: "Failed",
        description: error.message || "Failed to generate password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!customer || !generatedPassword) {
      toast({
        title: "Generate Password First",
        description: "Please generate a password before sending credentials",
        variant: "destructive",
      });
      return;
    }

    setSendingCredentials(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-customer-credentials', {
        body: {
          email: customer.email,
          password: generatedPassword,
          customerName: editFirstName || editName?.split(' ')[0] || 'Customer'
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Credentials Sent",
        description: `Login details sent to ${customer.email}`,
      });

    } catch (error: any) {
      console.error('Send credentials error:', error);
      toast({
        title: "Failed to Send",
        description: error.message || "Failed to send credentials email",
        variant: "destructive",
      });
    } finally {
      setSendingCredentials(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Accessibility className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Customer Login Support</h2>
          <p className="text-sm text-muted-foreground">
            Help elderly and accessibility customers access their dashboard
          </p>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5" />
            Find Customer
          </CardTitle>
          <CardDescription>
            Search by email address or vehicle registration plate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setSearchRegPlate('');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Registration Plate</Label>
              <Input
                placeholder="AB12 CDE"
                value={searchRegPlate}
                onChange={(e) => {
                  setSearchRegPlate(e.target.value.toUpperCase());
                  setSearchEmail('');
                }}
              />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Customer
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Customer Found Section */}
      {customer && (
        <>
          {/* Customer Info Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  {customer.name}
                </CardTitle>
                <div className="flex gap-2">
                  {hasAuthAccount === true && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Has Login
                    </Badge>
                  )}
                  {hasAuthAccount === false && (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      No Login Account
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>
                {customer.email} • {customer.registration_plate} • {customer.plan_type}
                {policies.length > 0 && ` • ${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}`}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Edit Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Edit Customer Details
              </CardTitle>
              <CardDescription>
                Update details for customers who cannot do it themselves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input value={editPostcode} onChange={(e) => setEditPostcode(e.target.value)} />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium">Address Details</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Flat Number</Label>
                  <Input value={editFlatNumber} onChange={(e) => setEditFlatNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Building Name</Label>
                  <Input value={editBuildingName} onChange={(e) => setEditBuildingName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Building Number</Label>
                  <Input value={editBuildingNumber} onChange={(e) => setEditBuildingNumber(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Street</Label>
                  <Input value={editStreet} onChange={(e) => setEditStreet(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Town</Label>
                  <Input value={editTown} onChange={(e) => setEditTown(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>County</Label>
                  <Input value={editCounty} onChange={(e) => setEditCounty(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleSaveDetails} disabled={savingDetails} className="gap-2">
                {savingDetails ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Details to Dashboard
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Login Credentials Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="w-5 h-5" />
                Login Credentials
              </CardTitle>
              <CardDescription>
                Generate, test, and send login credentials to customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generated Password Display */}
              {generatedPassword && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <AlertDescription className="ml-2">
                    <div className="font-medium text-green-800 mb-2">New Password Generated:</div>
                    <div className="flex items-center gap-2 bg-white rounded p-2 border">
                      <code className="flex-1 font-mono text-lg">{generatedPassword}</code>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedPassword)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      Email: {customer.email}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Test Login Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password (for testing)</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password to test"
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleTestLogin} 
                    disabled={loading || !testPassword}
                    variant="outline"
                    className="gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Test Login
                  </Button>
                  {loginTestResult === 'success' && (
                    <Badge variant="default" className="ml-2 bg-green-600">✓ Works</Badge>
                  )}
                  {loginTestResult === 'failed' && (
                    <Badge variant="destructive" className="ml-2">✗ Failed</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={handleGeneratePassword} 
                  disabled={loading}
                  variant="default"
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Generate New Password
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleSendCredentials} 
                  disabled={sendingCredentials || !generatedPassword}
                  variant="secondary"
                  className="gap-2"
                >
                  {sendingCredentials ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Credentials to Customer
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                💡 Generate a password, test it works, then send the login details to the customer's email.
                The customer dashboard URL is: <strong>https://buyawarranty.co.uk/customer-dashboard/</strong>
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CustomerLoginsTab;
