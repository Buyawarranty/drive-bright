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
  KeyRound, CheckCircle, AlertCircle, Loader2, Copy, Shield, Settings
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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
  labour_rate?: number;
}

interface PolicyData {
  id: string;
  policy_number: string;
  plan_type: string;
  status: string;
  policy_start_date: string;
  policy_end_date: string;
  claim_limit?: number;
  voluntary_excess?: number;
  additional_notes?: string;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  wear_tear?: boolean;
  tyre_cover?: boolean;
  transfer_cover?: boolean;
  europe_cover?: boolean;
  mot_fee?: boolean;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
}

const CustomerLoginsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingWarranty, setSavingWarranty] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  
  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchRegPlate, setSearchRegPlate] = useState('');
  
  // Customer data state
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
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
  
  // Warranty editable fields
  const [editClaimLimit, setEditClaimLimit] = useState<number>(1000);
  const [editVoluntaryExcess, setEditVoluntaryExcess] = useState<number>(0);
  const [editLabourRate, setEditLabourRate] = useState<number>(70);
  const [editAdditionalNotes, setEditAdditionalNotes] = useState('');
  const [editBreakdownRecovery, setEditBreakdownRecovery] = useState(false);
  const [editVehicleRental, setEditVehicleRental] = useState(false);
  const [editWearTear, setEditWearTear] = useState(false);
  const [editTyreCover, setEditTyreCover] = useState(false);
  const [editTransferCover, setEditTransferCover] = useState(false);
  const [editEuropeCover, setEditEuropeCover] = useState(false);
  const [editMotFee, setEditMotFee] = useState(false);
  const [editMotRepair, setEditMotRepair] = useState(false);
  const [editLostKey, setEditLostKey] = useState(false);
  const [editConsequential, setEditConsequential] = useState(false);
  
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

  const populateWarrantyFields = (policy: PolicyData, customerData: CustomerData) => {
    setEditClaimLimit(policy.claim_limit || 1000);
    setEditVoluntaryExcess(policy.voluntary_excess || 0);
    setEditLabourRate(customerData.labour_rate || 70);
    setEditAdditionalNotes(policy.additional_notes || '');
    setEditBreakdownRecovery(policy.breakdown_recovery || false);
    setEditVehicleRental(policy.vehicle_rental || false);
    setEditWearTear(policy.wear_tear || false);
    setEditTyreCover(policy.tyre_cover || false);
    setEditTransferCover(policy.transfer_cover || false);
    setEditEuropeCover(policy.europe_cover || false);
    setEditMotFee(policy.mot_fee || false);
    setEditMotRepair(policy.mot_repair || false);
    setEditLostKey(policy.lost_key || false);
    setEditConsequential(policy.consequential || false);
  };

  const handlePolicySelect = (policyId: string) => {
    setSelectedPolicyId(policyId);
    const policy = policies.find(p => p.id === policyId);
    if (policy && customer) {
      populateWarrantyFields(policy, customer);
    }
  };

  const handleSaveWarranty = async () => {
    if (!customer || !selectedPolicyId) return;

    setSavingWarranty(true);
    try {
      // Update the customer's labour rate
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          labour_rate: editLabourRate,
        })
        .eq('id', customer.id);

      if (customerError) throw customerError;

      // Update the selected policy
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          claim_limit: editClaimLimit,
          voluntary_excess: editVoluntaryExcess,
          additional_notes: editAdditionalNotes || null,
          breakdown_recovery: editBreakdownRecovery,
          vehicle_rental: editVehicleRental,
          wear_tear: editWearTear,
          tyre_cover: editTyreCover,
          transfer_cover: editTransferCover,
          europe_cover: editEuropeCover,
          mot_fee: editMotFee,
          mot_repair: editMotRepair,
          lost_key: editLostKey,
          consequential: editConsequential,
        })
        .eq('id', selectedPolicyId);

      if (policyError) throw policyError;

      toast({
        title: "✅ Warranty Details Saved",
        description: "Customer's warranty details updated. Dashboard will reflect changes.",
      });

      // Update local customer state
      setCustomer({
        ...customer,
        labour_rate: editLabourRate,
      });

      // Update local policy state
      setPolicies(policies.map(p => 
        p.id === selectedPolicyId 
          ? {
              ...p,
              claim_limit: editClaimLimit,
              voluntary_excess: editVoluntaryExcess,
              additional_notes: editAdditionalNotes,
              breakdown_recovery: editBreakdownRecovery,
              vehicle_rental: editVehicleRental,
              wear_tear: editWearTear,
              tyre_cover: editTyreCover,
              transfer_cover: editTransferCover,
              europe_cover: editEuropeCover,
              mot_fee: editMotFee,
              mot_repair: editMotRepair,
              lost_key: editLostKey,
              consequential: editConsequential,
            }
          : p
      ));

    } catch (error: any) {
      console.error('Save warranty error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save warranty details",
        variant: "destructive",
      });
    } finally {
      setSavingWarranty(false);
    }
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
      // Normalize search term - remove spaces for reg plate comparison
      const normalizedRegPlate = searchRegPlate?.replace(/\s/g, '').toUpperCase() || '';
      
      let query = supabase.from('customers').select('*');
      
      if (searchEmail) {
        query = query.ilike('email', `%${searchEmail.trim()}%`);
      } else if (searchRegPlate) {
        // Search both with and without spaces in the registration plate
        query = query.or(`registration_plate.ilike.%${normalizedRegPlate}%,registration_plate.ilike.%${searchRegPlate.trim()}%`);
      }

      const { data: customers, error } = await query.limit(1);

      if (error) throw error;

      // If no customer found, try to find in live_quotes and offer to create customer
      if (!customers || customers.length === 0) {
        // Search live_quotes for this customer
        let quoteQuery = supabase.from('live_quotes').select('*').in('status', ['paid', 'paid_externally']);
        
        if (searchEmail) {
          quoteQuery = quoteQuery.ilike('customer_email', `%${searchEmail.trim()}%`);
        } else if (searchRegPlate) {
          quoteQuery = quoteQuery.or(`vehicle_reg.ilike.%${normalizedRegPlate}%,vehicle_reg.ilike.%${searchRegPlate.trim()}%`);
        }
        
        const { data: quotes } = await quoteQuery.limit(1);
        
        if (quotes && quotes.length > 0) {
          const quote = quotes[0];
          toast({
            title: "Found in Paid Orders",
            description: `Customer "${quote.customer_name}" found in paid orders but not in customer database. The customer record may need to be created via the Paid Orders section.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Customer Not Found",
            description: "No customer found with those details in customers or paid orders",
            variant: "destructive",
          });
        }
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

      // Get policies with warranty details
      const { data: policyData } = await supabase
        .from('customer_policies')
        .select('id, policy_number, plan_type, status, policy_start_date, policy_end_date, claim_limit, voluntary_excess, additional_notes, breakdown_recovery, vehicle_rental, wear_tear, tyre_cover, transfer_cover, europe_cover, mot_fee, mot_repair, lost_key, consequential')
        .ilike('email', foundCustomer.email);

      setPolicies(policyData || []);
      
      // Set the first policy as selected and populate warranty fields
      if (policyData && policyData.length > 0) {
        setSelectedPolicyId(policyData[0].id);
        populateWarrantyFields(policyData[0], foundCustomer);
      }
      
      // Set labour rate from customer
      setEditLabourRate(foundCustomer.labour_rate || 70);

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
                onChange={(e) => setSearchEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Registration Plate</Label>
                <Input
                  placeholder="AB12 CDE"
                  value={searchRegPlate}
                  onChange={(e) => setSearchRegPlate(e.target.value.toUpperCase())}
                />
              </div>
              <span className="text-sm text-muted-foreground pb-2.5">or</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Enter either email address OR registration plate to search</p>
          <Button onClick={handleSearch} disabled={loading || (!searchEmail && !searchRegPlate)} className="w-full md:w-auto">
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
            <CardContent className="pt-0">
              <Button 
                variant="outline" 
                className="gap-2 border-amber-500 text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  // Store impersonation data
                  sessionStorage.setItem('admin_impersonation', JSON.stringify({
                    customerId: customer.id,
                    customerEmail: customer.email,
                    customerName: customer.name,
                    isImpersonating: true,
                    timestamp: Date.now()
                  }));
                  // Open customer dashboard in new tab
                  window.open('/customer-dashboard', '_blank');
                }}
              >
                <Eye className="w-4 h-4" />
                View as Customer
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Opens customer dashboard in new tab to see exactly what they see</p>
            </CardContent>
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

          {/* Warranty Details Section */}
          {policies.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Warranty Details
                </CardTitle>
                <CardDescription>
                  Update claim limit, labour rate, add-ons, and notes for upgraded/downgraded warranties
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Policy Selector */}
                {policies.length > 1 && (
                  <div className="space-y-2">
                    <Label>Select Policy to Edit</Label>
                    <Select value={selectedPolicyId} onValueChange={handlePolicySelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a policy" />
                      </SelectTrigger>
                      <SelectContent>
                        {policies.map((policy) => (
                          <SelectItem key={policy.id} value={policy.id}>
                            {policy.policy_number} - {policy.plan_type} ({policy.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Core Warranty Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Claim Limit</Label>
                    <Select value={editClaimLimit.toString()} onValueChange={(v) => setEditClaimLimit(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">£500</SelectItem>
                        <SelectItem value="1000">£1,000</SelectItem>
                        <SelectItem value="1500">£1,500</SelectItem>
                        <SelectItem value="2000">£2,000</SelectItem>
                        <SelectItem value="2500">£2,500</SelectItem>
                        <SelectItem value="3000">£3,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Labour Rate</Label>
                    <Select value={editLabourRate.toString()} onValueChange={(v) => setEditLabourRate(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">£50/hr</SelectItem>
                        <SelectItem value="70">£70/hr (Standard)</SelectItem>
                        <SelectItem value="100">£100/hr</SelectItem>
                        <SelectItem value="150">£150/hr</SelectItem>
                        <SelectItem value="200">£200/hr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Voluntary Excess</Label>
                    <Select value={editVoluntaryExcess.toString()} onValueChange={(v) => setEditVoluntaryExcess(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">£0</SelectItem>
                        <SelectItem value="50">£50</SelectItem>
                        <SelectItem value="100">£100</SelectItem>
                        <SelectItem value="150">£150</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-medium">Add-On Protection</p>

                {/* Add-ons Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="breakdown" 
                      checked={editBreakdownRecovery}
                      onCheckedChange={(checked) => setEditBreakdownRecovery(checked as boolean)}
                    />
                    <Label htmlFor="breakdown" className="text-sm">Breakdown Recovery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="rental" 
                      checked={editVehicleRental}
                      onCheckedChange={(checked) => setEditVehicleRental(checked as boolean)}
                    />
                    <Label htmlFor="rental" className="text-sm">Vehicle Rental</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="wearTear" 
                      checked={editWearTear}
                      onCheckedChange={(checked) => setEditWearTear(checked as boolean)}
                    />
                    <Label htmlFor="wearTear" className="text-sm">Wear & Tear</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="tyreCover" 
                      checked={editTyreCover}
                      onCheckedChange={(checked) => setEditTyreCover(checked as boolean)}
                    />
                    <Label htmlFor="tyreCover" className="text-sm">Tyre Cover</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="transferCover" 
                      checked={editTransferCover}
                      onCheckedChange={(checked) => setEditTransferCover(checked as boolean)}
                    />
                    <Label htmlFor="transferCover" className="text-sm">Transfer Cover</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="europeCover" 
                      checked={editEuropeCover}
                      onCheckedChange={(checked) => setEditEuropeCover(checked as boolean)}
                    />
                    <Label htmlFor="europeCover" className="text-sm">Europe Cover</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="motFee" 
                      checked={editMotFee}
                      onCheckedChange={(checked) => setEditMotFee(checked as boolean)}
                    />
                    <Label htmlFor="motFee" className="text-sm">MOT Fee</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="motRepair" 
                      checked={editMotRepair}
                      onCheckedChange={(checked) => setEditMotRepair(checked as boolean)}
                    />
                    <Label htmlFor="motRepair" className="text-sm">MOT Repair</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="lostKey" 
                      checked={editLostKey}
                      onCheckedChange={(checked) => setEditLostKey(checked as boolean)}
                    />
                    <Label htmlFor="lostKey" className="text-sm">Lost Key</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="consequential" 
                      checked={editConsequential}
                      onCheckedChange={(checked) => setEditConsequential(checked as boolean)}
                    />
                    <Label htmlFor="consequential" className="text-sm">Consequential Loss</Label>
                  </div>
                </div>

                <Separator />

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">Additional Notes (visible in Customer Dashboard)</Label>
                  <Textarea
                    id="additionalNotes"
                    value={editAdditionalNotes}
                    onChange={(e) => setEditAdditionalNotes(e.target.value)}
                    placeholder="e.g., Transfer cover included, Labour rate increased to £150/hr, 3 months FREE extended cover..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    These notes will be displayed in the customer's dashboard under "Additional Notes"
                  </p>
                </div>

                <Button onClick={handleSaveWarranty} disabled={savingWarranty} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  {savingWarranty ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Warranty...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Warranty Details
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

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
