import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Save, User, CheckCircle, AlertCircle, Loader2, 
  FileText, Settings, Shield, Car, Pencil
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
  claim_limit?: number;
  voluntary_excess?: number;
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

const claimLimitOptions = [
  500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 5000
];

const excessOptions = [0, 50, 100, 150, 200];

const labourRateOptions = [50, 70, 100, 150, 200];

const CustomerPolicyUpdateTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchRegPlate, setSearchRegPlate] = useState('');
  
  // Customer data state
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  
  // Editable warranty fields
  const [editClaimLimit, setEditClaimLimit] = useState<number>(1250);
  const [editVoluntaryExcess, setEditVoluntaryExcess] = useState<number>(100);
  const [editLabourRate, setEditLabourRate] = useState<number>(70);
  const [editAdditionalNotes, setEditAdditionalNotes] = useState('');
  
  // Add-on upgrades
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

  const handleSearch = async () => {
    if (!searchEmail && !searchRegPlate) {
      toast({
        title: "Enter Search Criteria",
        description: "Please enter an email address or registration plate",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setCustomer(null);
    setPolicies([]);
    setSelectedPolicyId('');

    try {
      let customerQuery = supabase
        .from('customers')
        .select('*')
        .eq('is_deleted', false);

      if (searchEmail) {
        customerQuery = customerQuery.ilike('email', `%${searchEmail.trim()}%`);
      } else if (searchRegPlate) {
        // Use wildcards for partial matching - handles spaces and partial plate searches
        const normalizedSearch = searchRegPlate.trim().replace(/\s/g, '');
        customerQuery = customerQuery.or(
          `registration_plate.ilike.%${searchRegPlate.trim()}%,registration_plate.ilike.%${normalizedSearch}%`
        );
      }

      const { data: customerData, error: customerError } = await customerQuery.limit(1).single();

      if (customerError || !customerData) {
        toast({
          title: "Customer Not Found",
          description: "No customer found with those details. Try a different search.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const foundCustomer: CustomerData = {
        id: customerData.id,
        email: customerData.email,
        name: customerData.name,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        phone: customerData.phone,
        registration_plate: customerData.registration_plate,
        plan_type: customerData.plan_type,
        claim_limit: customerData.claim_limit,
        voluntary_excess: customerData.voluntary_excess,
        labour_rate: customerData.labour_rate,
      };

      setCustomer(foundCustomer);

      // Fetch policies for this customer
      const { data: policiesData, error: policiesError } = await supabase
        .from('customer_policies')
        .select('*')
        .ilike('email', foundCustomer.email)
        .order('created_at', { ascending: false });

      if (!policiesError && policiesData && policiesData.length > 0) {
        setPolicies(policiesData);
        // Auto-select first policy
        const firstPolicy = policiesData[0];
        setSelectedPolicyId(firstPolicy.id);
        loadPolicyData(firstPolicy);
      }

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

  const loadPolicyData = (policy: PolicyData) => {
    setEditClaimLimit(policy.claim_limit || 1250);
    setEditVoluntaryExcess(policy.voluntary_excess || 100);
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
    // Labour rate from customer record
    if (customer) {
      setEditLabourRate(customer.labour_rate || 70);
    }
  };

  const handlePolicyChange = (policyId: string) => {
    setSelectedPolicyId(policyId);
    const policy = policies.find(p => p.id === policyId);
    if (policy) {
      loadPolicyData(policy);
    }
  };

  const handleSaveUpdates = async () => {
    if (!customer || !selectedPolicyId) {
      toast({
        title: "No Policy Selected",
        description: "Please search for a customer and select a policy first",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Update customer_policies table (for customer dashboard)
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
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
        })
        .eq('id', selectedPolicyId);

      if (policyError) throw policyError;

      // Update customers table for labour rate and claim limit (for Sales Customer Management)
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          claim_limit: editClaimLimit,
          voluntary_excess: editVoluntaryExcess,
          labour_rate: editLabourRate,
          breakdown_recovery: editBreakdownRecovery,
          wear_tear: editWearTear,
          tyre_cover: editTyreCover,
          transfer_cover: editTransferCover,
          europe_cover: editEuropeCover,
          mot_fee: editMotFee,
          mot_repair: editMotRepair,
          lost_key: editLostKey,
          consequential: editConsequential,
        })
        .eq('id', customer.id);

      if (customerError) {
        console.error('Customer update warning:', customerError);
      }

      // Update local state
      setPolicies(prev => prev.map(p => 
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

      toast({
        title: "✅ Updates Saved",
        description: "Policy details updated. Customer dashboard will reflect changes immediately.",
      });

    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save updates",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Pencil className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Update Customer Policy</h2>
          <p className="text-sm text-muted-foreground">
            Update additional notes, claim limits, and add-on upgrades for customers
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <FileText className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Changes made here will update the customer's dashboard immediately. 
          <strong> This does NOT send data to Warranties Register</strong> - it only updates internal records.
        </AlertDescription>
      </Alert>

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
                  <User className="w-5 h-5 text-primary" />
                  {customer.name}
                </CardTitle>
                <Badge variant="secondary" className="gap-1">
                  <Car className="w-3 h-3" />
                  {customer.registration_plate}
                </Badge>
              </div>
              <CardDescription>
                {customer.email} • {customer.plan_type}
                {policies.length > 0 && ` • ${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}`}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Policy Selector */}
          {policies.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Select Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedPolicyId} onValueChange={handlePolicyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a policy to update" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policy_number} - {policy.plan_type} ({policy.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Policy Details Card */}
          {selectedPolicy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5" />
                  Update Policy Details
                </CardTitle>
                <CardDescription>
                  Policy: {selectedPolicy.policy_number} • {selectedPolicy.plan_type}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Coverage Limits */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Coverage Limits
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Claim Limit (£)</Label>
                      <Select 
                        value={editClaimLimit.toString()} 
                        onValueChange={(v) => setEditClaimLimit(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {claimLimitOptions.map((limit) => (
                            <SelectItem key={limit} value={limit.toString()}>
                              £{limit.toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Voluntary Excess (£)</Label>
                      <Select 
                        value={editVoluntaryExcess.toString()} 
                        onValueChange={(v) => setEditVoluntaryExcess(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {excessOptions.map((excess) => (
                            <SelectItem key={excess} value={excess.toString()}>
                              £{excess}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Labour Rate (£/hr)</Label>
                      <Select 
                        value={editLabourRate.toString()} 
                        onValueChange={(v) => setEditLabourRate(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {labourRateOptions.map((rate) => (
                            <SelectItem key={rate} value={rate.toString()}>
                              £{rate}/hr
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Add-on Upgrades */}
                <div>
                  <h4 className="font-medium mb-3">Add-on Upgrades</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="breakdown" 
                        checked={editBreakdownRecovery}
                        onCheckedChange={(c) => setEditBreakdownRecovery(!!c)}
                      />
                      <Label htmlFor="breakdown" className="text-sm cursor-pointer">
                        Breakdown Recovery
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="rental" 
                        checked={editVehicleRental}
                        onCheckedChange={(c) => setEditVehicleRental(!!c)}
                      />
                      <Label htmlFor="rental" className="text-sm cursor-pointer">
                        Vehicle Rental
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="wear" 
                        checked={editWearTear}
                        onCheckedChange={(c) => setEditWearTear(!!c)}
                      />
                      <Label htmlFor="wear" className="text-sm cursor-pointer">
                        Wear & Tear
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="tyre" 
                        checked={editTyreCover}
                        onCheckedChange={(c) => setEditTyreCover(!!c)}
                      />
                      <Label htmlFor="tyre" className="text-sm cursor-pointer">
                        Tyre Cover
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="transfer" 
                        checked={editTransferCover}
                        onCheckedChange={(c) => setEditTransferCover(!!c)}
                      />
                      <Label htmlFor="transfer" className="text-sm cursor-pointer">
                        Transfer Cover
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="europe" 
                        checked={editEuropeCover}
                        onCheckedChange={(c) => setEditEuropeCover(!!c)}
                      />
                      <Label htmlFor="europe" className="text-sm cursor-pointer">
                        Europe Cover
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="motfee" 
                        checked={editMotFee}
                        onCheckedChange={(c) => setEditMotFee(!!c)}
                      />
                      <Label htmlFor="motfee" className="text-sm cursor-pointer">
                        MOT Fee
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="motrepair" 
                        checked={editMotRepair}
                        onCheckedChange={(c) => setEditMotRepair(!!c)}
                      />
                      <Label htmlFor="motrepair" className="text-sm cursor-pointer">
                        MOT Repair
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="lostkey" 
                        checked={editLostKey}
                        onCheckedChange={(c) => setEditLostKey(!!c)}
                      />
                      <Label htmlFor="lostkey" className="text-sm cursor-pointer">
                        Lost Key
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="consequential" 
                        checked={editConsequential}
                        onCheckedChange={(c) => setEditConsequential(!!c)}
                      />
                      <Label htmlFor="consequential" className="text-sm cursor-pointer">
                        Consequential
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Additional Notes
                  </Label>
                  <Textarea
                    value={editAdditionalNotes}
                    onChange={(e) => setEditAdditionalNotes(e.target.value)}
                    placeholder="Enter any additional notes for this policy (e.g., special terms, upgrades provided, etc.)"
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    These notes will be visible on the customer's dashboard
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSaveUpdates} 
                    disabled={saving}
                    size="lg"
                    className="gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Updates
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerPolicyUpdateTab;
