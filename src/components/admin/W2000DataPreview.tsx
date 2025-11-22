import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  country?: string;
  plan_type: string;
  voluntary_excess?: number;
  registration_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  payment_type?: string;
  warranty_reference_number?: string;
  warranty_number?: string;
  // Add-on fields
  tyre_cover?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  transfer_cover?: boolean;
  breakdown_recovery?: boolean;
  vehicle_rental?: boolean;
  mot_fee?: boolean;
  claim_limit?: number;
  mot_repair?: boolean;
  lost_key?: boolean;
  consequential?: boolean;
  customer_policies?: Array<{
    id?: string;
    policy_number: string;
    warranty_number?: string;
    voluntary_excess?: number;
    claim_limit?: number;
    tyre_cover?: boolean;
    wear_tear?: boolean;
    europe_cover?: boolean;
    transfer_cover?: boolean;
    breakdown_recovery?: boolean;
    vehicle_rental?: boolean;
    mot_fee?: boolean;
    mot_repair?: boolean;
    lost_key?: boolean;
    consequential?: boolean;
  }>;
}

interface W2000DataPreviewProps {
  customer: Customer;
}

// Helper function to map plan types to warranty types (matches W2000 function exactly)
function getWarrantyType(planType: string): string {
  const warrantyTypeMapping: Record<string, string> = {
    'basic': 'B-PLATINUM',
    'gold': 'B-PLATINUM', 
    'platinum': 'B-PLATINUM',
    'premium': 'B-PLATINUM',
    'electric': 'B-EV',
    'ev': 'B-EV',
    'electric vehicle ev extended warranty': 'B-EV',
    'phev': 'B-PHEV',
    'hybrid': 'B-PHEV',
    'phev hybrid extended warranty': 'B-PHEV',
    'motorbike': 'B-MOTORBIKE',
    'motorcycle': 'B-MOTORBIKE',
    'motorbike extended warranty': 'B-MOTORBIKE'
  };
  
  const lowerPlanType = planType?.toLowerCase() || '';
  return warrantyTypeMapping[lowerPlanType] || 'B-PLATINUM';
}

// Helper function to calculate coverage months (matches W2000 function exactly)
function getWarrantyDurationInMonths(paymentType: string): number {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
    case '12months':
    case '12month':
    case 'yearly':
      return 12;
    case '24months':
    case '24month':
    case 'twomonthly':
    case '2monthly':
    case 'twoyearly':
      return 24;
    case '36months':
    case '36month':
    case 'threemonthly':
    case '3monthly':
    case 'threeyearly':
      return 36;
    case '48months':
    case '48month':
    case 'fourmonthly':
    case '4monthly':
      return 48;
    case '60months':
    case '60month':
    case 'fivemonthly':
    case '5monthly':
      return 60;
    default:
      return 12;
  }
}

export const W2000DataPreview: React.FC<W2000DataPreviewProps> = ({ customer }) => {
  // Get policy data (same logic as W2000 function)
  const policy = customer.customer_policies?.[0];
  
  // Build the exact same registration data as sent to W2000
  const planType = (policy?.claim_limit || customer.plan_type || 'basic').toString().toLowerCase();
  const warrantyType = getWarrantyType(planType);
  const paymentType = customer.payment_type || 'yearly';
  const coverageMonths = getWarrantyDurationInMonths(paymentType);
  
  // Get claim limit (same validation as W2000 function)
  const rawClaimLimit = policy?.claim_limit || customer?.claim_limit || 1250;
  const validClaimLimits = [750, 1250, 2000];
  const maxClaimAmount = validClaimLimits.includes(rawClaimLimit) ? rawClaimLimit.toString() : '1250';
  
  // Build exact W2000 registration data structure
  const w2000Data = {
    // Customer Information
    Title: "Mr",
    First: customer.first_name || customer.name?.split(' ')[0] || "Customer",
    Surname: customer.last_name || customer.name?.split(' ').slice(1).join(' ') || "Name",
    
    // Address (exact same logic as W2000 function)
    Addr1: (() => {
      let address1 = "";
      if (customer.building_number && customer.street) {
        address1 = `${customer.building_number} ${customer.street}`;
      } else if (customer.street) {
        address1 = customer.street;
      } else if (customer.building_name) {
        address1 = customer.building_name;
      } else {
        address1 = "Address Line 1";
      }
      return address1;
    })(),
    
    Addr2: (() => {
      if (customer.flat_number && customer.building_name && !customer.street) {
        return `${customer.flat_number}, ${customer.building_name}`;
      } else if (customer.flat_number) {
        return customer.flat_number;
      } else if (customer.building_name && customer.street) {
        return customer.building_name;
      }
      return "";
    })(),
    
    Town: customer.town || "Town",
    PCode: customer.postcode || "UNKNOWN",
    Tel: customer.phone && customer.phone.trim() ? customer.phone.trim() : "N/A",
    Mobile: customer.phone && customer.phone.trim() ? customer.phone.trim() : "N/A",
    EMail: customer.email,
    
    // Purchase and Vehicle Data
    PurDate: new Date().toISOString().split('T')[0],
    Make: customer.vehicle_make && customer.vehicle_make.trim() ? customer.vehicle_make.trim() : "UNKNOWN",
    Model: customer.vehicle_model && customer.vehicle_model.trim() ? customer.vehicle_model.trim() : "UNKNOWN",
    RegNum: customer.registration_plate || "UNKNOWN",
    Mileage: customer.mileage || "50000",
    EngSize: "1968",
    PurPrc: "1", // Hidden for privacy
    RegDate: customer.vehicle_year ? `${customer.vehicle_year}-01-01` : "2020-01-01",
    
    // Warranty Configuration
    WarType: warrantyType,
    Month: coverageMonths.toString(),
    MaxClm: maxClaimAmount,
    VolEx: (policy?.voluntary_excess || customer.voluntary_excess || 0).toString(),
    
    // Reference and MOT
    Ref: policy?.policy_number || policy?.warranty_number || customer.warranty_reference_number || `REF-${Date.now()}`,
    MOTDue: (() => {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return nextYear.toISOString().split('T')[0];
    })(),
    
    // Add-ons (exact same logic as W2000 function)
    mot_fee: (policy?.mot_fee === true || customer?.mot_fee === true),
    tyre_cover: (policy?.tyre_cover === true || customer?.tyre_cover === true),
    wear_tear: (policy?.wear_tear === true || customer?.wear_tear === true),
    europe_cover: (policy?.europe_cover === true || customer?.europe_cover === true),
    transfer_cover: (policy?.transfer_cover === true || customer?.transfer_cover === true),
    breakdown_recovery: (policy?.breakdown_recovery === true || customer?.breakdown_recovery === true),
    vehicle_rental: (policy?.vehicle_rental === true || customer?.vehicle_rental === true),
    mot_repair: (policy?.mot_repair === true || customer?.mot_repair === true),
    lost_key: (policy?.lost_key === true || customer?.lost_key === true),
    consequential: (policy?.consequential === true || customer?.consequential === true),
    
    Notes: `Plan: ${policy?.claim_limit || customer.plan_type || 'N/A'} | Payment: ${paymentType || 'N/A'} | ClaimLimit: ${maxClaimAmount} | VolExcess: ${policy?.voluntary_excess || customer.voluntary_excess || 0}`
  };

  const addOns = [
    { key: 'mot_fee', label: 'MOT Test Fee', value: w2000Data.mot_fee },
    { key: 'tyre_cover', label: 'Tyre Cover', value: w2000Data.tyre_cover },
    { key: 'wear_tear', label: 'Wear & Tear', value: w2000Data.wear_tear },
    { key: 'europe_cover', label: 'Europe Cover', value: w2000Data.europe_cover },
    { key: 'transfer_cover', label: 'Transfer Cover', value: w2000Data.transfer_cover },
    { key: 'breakdown_recovery', label: '24/7 Recovery', value: w2000Data.breakdown_recovery },
    { key: 'vehicle_rental', label: 'Vehicle Rental', value: w2000Data.vehicle_rental },
    { key: 'mot_repair', label: 'MOT Repair', value: w2000Data.mot_repair },
    { key: 'lost_key', label: 'Lost Key', value: w2000Data.lost_key },
    { key: 'consequential', label: 'Consequential Damage', value: w2000Data.consequential },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-blue-400 mr-2" />
          <h4 className="text-blue-800 font-semibold">Warranties 2000 Data Preview</h4>
        </div>
        <p className="text-blue-700 text-sm mt-1">
          This shows exactly what data is/was sent to Warranties 2000 API
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Customer Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Title:</span>
              <span>{w2000Data.Title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">First Name:</span>
              <span>{w2000Data.First}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Surname:</span>
              <span>{w2000Data.Surname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="truncate">{w2000Data.EMail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span>{w2000Data.Tel}</span>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Addr1:</span>
              <span>{w2000Data.Addr1}</span>
            </div>
            {w2000Data.Addr2 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Addr2:</span>
                <span>{w2000Data.Addr2}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Town:</span>
              <span>{w2000Data.Town}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Postcode:</span>
              <span>{w2000Data.PCode}</span>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Registration:</span>
              <span className="font-mono">{w2000Data.RegNum}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Make:</span>
              <span>{w2000Data.Make}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Model:</span>
              <span>{w2000Data.Model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mileage:</span>
              <span>{w2000Data.Mileage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Engine Size:</span>
              <span>{w2000Data.EngSize}cc</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reg Date:</span>
              <span>{w2000Data.RegDate}</span>
            </div>
          </CardContent>
        </Card>

        {/* Warranty Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Warranty Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Warranty Type:</span>
              <Badge variant="outline">{w2000Data.WarType}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Coverage:</span>
              <span>{w2000Data.Month} months</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Claim Limit:</span>
              <span>£{w2000Data.MaxClm}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Voluntary Excess:</span>
              <span>£{w2000Data.VolEx}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reference:</span>
              <span className="font-mono text-xs">{w2000Data.Ref}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">MOT Due:</span>
              <span>{w2000Data.MOTDue}</span>
            </div>
          </CardContent>
        </Card>

        {/* Add-On Protections */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add-On Protection Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {addOns.map((addon) => (
                <div key={addon.key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-xs font-medium">{addon.label}</span>
                  {addon.value ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">W2000 Notes Field</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-700 font-mono bg-gray-100 p-2 rounded">
              {w2000Data.Notes}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};