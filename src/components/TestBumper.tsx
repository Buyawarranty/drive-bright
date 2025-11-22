import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";

interface BumperTestData {
  planId: string;
  paymentType: string;
  voluntaryExcess: number;
  vehicleData: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    address: string;
    city: string;
    postcode: string;
    registrationNumber: string;
    make: string;
    model: string;
    year: string;
    mileage: string;
  };
  customerData: {
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    flat_number?: string;
    building_name?: string;
    building_number?: string;
    street: string;
    town: string;
    county: string;
    postcode: string;
    country: string;
    vehicle_reg: string;
  };
}

export default function TestBumper() {
  const [testData, setTestData] = useState<BumperTestData>({
    planId: 'basic',
    paymentType: 'monthly',
    voluntaryExcess: 0,
    vehicleData: {
      email: 'test@bumpertest.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '07123456789',
      dateOfBirth: '1985-06-15',
      address: '123 Test Street',
      city: 'London',
      postcode: 'SW1A 1AA',
      registrationNumber: 'AB12CDE',
      make: 'Ford',
      model: 'Focus',
      year: '2020',
      mileage: '25000'
    },
    customerData: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'test@bumpertest.com',
      mobile: '07123456789',
      street: '123 Test Street',
      town: 'London',
      county: 'Greater London',
      postcode: 'SW1A 1AA',
      country: 'GB',
      vehicle_reg: 'AB12CDE'
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('vehicleData.')) {
      const vehicleField = field.split('.')[1];
      setTestData(prev => ({
        ...prev,
        vehicleData: {
          ...prev.vehicleData,
          [vehicleField]: value
        },
        customerData: {
          ...prev.customerData,
          // Sync relevant fields between vehicleData and customerData
          ...(vehicleField === 'firstName' && { first_name: value }),
          ...(vehicleField === 'lastName' && { last_name: value }),
          ...(vehicleField === 'phone' && { mobile: value }),
          ...(vehicleField === 'email' && { email: value }),
          ...(vehicleField === 'address' && { street: value }),
          ...(vehicleField === 'city' && { town: value }),
          ...(vehicleField === 'postcode' && { postcode: value }),
          ...(vehicleField === 'registrationNumber' && { vehicle_reg: value }),
        }
      }));
    } else {
      setTestData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleTestBumperAPI = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing Bumper API with data:', testData);

      const { data, error } = await supabase.functions.invoke('create-bumper-checkout', {
        body: testData
      });

      if (error) {
        throw error;
      }

      console.log('Bumper API Response:', data);
      setResult(data);

      if (data.success) {
        toast({
          title: "Bumper API Test Successful",
          description: data.url ? "Checkout URL generated successfully" : "Test completed successfully",
        });
      } else {
        toast({
          title: "Bumper API Test Warning",
          description: data.message || "Test completed with warnings",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Bumper API test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Bumper API Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const populateWithTestData = () => {
    setTestData({
      planId: 'gold',
      paymentType: 'monthly',
      voluntaryExcess: 100,
      vehicleData: {
        email: 'bumpertest@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '07987654321',
        dateOfBirth: '1990-03-20',
        address: '456 Demo Road',
        city: 'Manchester',
        postcode: 'M1 1AA',
        registrationNumber: 'XY21ABC',
        make: 'BMW',
        model: 'X3',
        year: '2021',
        mileage: '15000'
      },
      customerData: {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'bumpertest@example.com',
        mobile: '07987654321',
        street: '456 Demo Road',
        town: 'Manchester',
        county: 'Greater Manchester',
        postcode: 'M1 1AA',
        country: 'GB',
        vehicle_reg: 'XY21ABC'
      }
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Test Bumper API
              <Badge variant="outline">Finance</Badge>
            </CardTitle>
            <CardDescription>
              Test the Bumper credit check and finance application API with real data
            </CardDescription>
          </div>
          <Button variant="outline" onClick={populateWithTestData}>
            Fill Test Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="planId">Plan Type</Label>
            <Select value={testData.planId} onValueChange={(value) => handleInputChange('planId', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentType">Payment Type</Label>
            <Select value={testData.paymentType} onValueChange={(value) => handleInputChange('paymentType', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="two_yearly">2 Years</SelectItem>
                <SelectItem value="three_yearly">3 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voluntaryExcess">Voluntary Excess (£)</Label>
            <Select value={testData.voluntaryExcess.toString()} onValueChange={(value) => handleInputChange('voluntaryExcess', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">£0</SelectItem>
                <SelectItem value="50">£50</SelectItem>
                <SelectItem value="100">£100</SelectItem>
                <SelectItem value="150">£150</SelectItem>
                <SelectItem value="200">£200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Customer Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={testData.vehicleData.email}
                onChange={(e) => handleInputChange('vehicleData.email', e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={testData.vehicleData.phone}
                onChange={(e) => handleInputChange('vehicleData.phone', e.target.value)}
                placeholder="07123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={testData.vehicleData.firstName}
                onChange={(e) => handleInputChange('vehicleData.firstName', e.target.value)}
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={testData.vehicleData.lastName}
                onChange={(e) => handleInputChange('vehicleData.lastName', e.target.value)}
                placeholder="Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={testData.vehicleData.dateOfBirth}
                onChange={(e) => handleInputChange('vehicleData.dateOfBirth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={testData.vehicleData.postcode}
                onChange={(e) => handleInputChange('vehicleData.postcode', e.target.value)}
                placeholder="SW1A 1AA"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={testData.vehicleData.address}
                onChange={(e) => handleInputChange('vehicleData.address', e.target.value)}
                placeholder="123 Test Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={testData.vehicleData.city}
                onChange={(e) => handleInputChange('vehicleData.city', e.target.value)}
                placeholder="London"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Vehicle Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <Input
                id="registrationNumber"
                value={testData.vehicleData.registrationNumber}
                onChange={(e) => handleInputChange('vehicleData.registrationNumber', e.target.value.toUpperCase())}
                placeholder="AB12CDE"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={testData.vehicleData.make}
                onChange={(e) => handleInputChange('vehicleData.make', e.target.value)}
                placeholder="Ford"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={testData.vehicleData.model}
                onChange={(e) => handleInputChange('vehicleData.model', e.target.value)}
                placeholder="Focus"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                value={testData.vehicleData.year}
                onChange={(e) => handleInputChange('vehicleData.year', e.target.value)}
                placeholder="2020"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Mileage</Label>
              <Input
                id="mileage"
                value={testData.vehicleData.mileage}
                onChange={(e) => handleInputChange('vehicleData.mileage', e.target.value)}
                placeholder="25000"
              />
            </div>
          </div>
        </div>

        {/* Test Button */}
        <div className="flex gap-4">
          <Button 
            onClick={handleTestBumperAPI} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Bumper API...
              </>
            ) : (
              'Test Bumper API'
            )}
          </Button>
        </div>

        {/* Results */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
              <XCircle className="h-5 w-5" />
              Error
            </div>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <h3 className="text-lg font-semibold">Test Results</h3>
            </div>

            {result.url && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">Bumper Checkout URL Generated</p>
                    <p className="text-green-700 text-sm">Customer can proceed with credit application</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(result.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </div>
            )}

            {result.fallbackToStripe && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-semibold text-yellow-800">Fallback to Stripe</p>
                <p className="text-yellow-700 text-sm">{result.fallbackReason}</p>
                {result.stripeUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => window.open(result.stripeUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Stripe Checkout
                  </Button>
                )}
              </div>
            )}

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Full Response</h4>
              <Textarea
                value={JSON.stringify(result, null, 2)}
                readOnly
                className="h-64 font-mono text-xs"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}