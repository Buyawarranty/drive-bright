import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, Check, AlertCircle, Search, MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// UK postcode validation regex
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

const isValidUKPostcode = (postcode: string): boolean => {
  return UK_POSTCODE_REGEX.test(postcode.replace(/\s/g, ''));
};

const formatPostcode = (postcode: string): string => {
  const cleaned = postcode.replace(/\s/g, '').toUpperCase();
  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
};

interface ExpandedAddress {
  formatted_address?: string[];
  line_1?: string;
  line_2?: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city?: string;
  county?: string;
  district?: string;
  country?: string;
  building_name?: string;
  building_number?: string;
  sub_building_name?: string;
  sub_building_number?: string;
  thoroughfare?: string;
  postcode?: string;
}

interface AddressData {
  postcode: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
}

interface PostcodeFirstAddressLookupProps {
  addressData: AddressData;
  onAddressChange: (data: AddressData) => void;
  addressErrors: { [key: string]: string };
  showValidation: boolean;
  addressValidated: { [key: string]: boolean };
  onValidateField: (field: string) => void;
}

type LookupState = 'initial' | 'loading' | 'results' | 'manual' | 'complete';

export const PostcodeFirstAddressLookup: React.FC<PostcodeFirstAddressLookupProps> = ({
  addressData,
  onAddressChange,
  addressErrors,
  showValidation,
  addressValidated,
  onValidateField,
}) => {
  const [lookupState, setLookupState] = useState<LookupState>(
    // If address is already populated, show as complete
    addressData.address_line_1 && addressData.town && addressData.postcode ? 'complete' : 'initial'
  );
  const [postcodeInput, setPostcodeInput] = useState(addressData.postcode || '');
  const [postcodeError, setPostcodeError] = useState('');
  // Store full address data from API
  const [cachedAddresses, setCachedAddresses] = useState<ExpandedAddress[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [apiError, setApiError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handlePostcodeChange = (value: string) => {
    const formatted = value.toUpperCase();
    setPostcodeInput(formatted);
    setPostcodeError('');
    setApiError('');
    // Reset state if they clear the postcode
    if (!formatted.trim()) {
      setLookupState('initial');
      setCachedAddresses([]);
    }
  };

  const handleFindAddress = async () => {
    // Validate postcode format
    if (!postcodeInput.trim()) {
      setPostcodeError('Please enter your postcode');
      return;
    }

    if (!isValidUKPostcode(postcodeInput)) {
      setPostcodeError('Please enter a valid UK postcode');
      return;
    }

    setIsLoading(true);
    setLookupState('loading');
    setPostcodeError('');
    setApiError('');

    try {
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'find', postcode: postcodeInput }
      });

      console.log('getaddress-lookup response:', data, error);

      if (error) {
        console.error('Postcode lookup error:', error);
        setApiError('Address lookup temporarily unavailable. Please enter your address manually.');
        setLookupState('manual');
        onAddressChange({ ...addressData, postcode: formatPostcode(postcodeInput) });
        return;
      }

      if (data?.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
        // Cache the full address data
        setCachedAddresses(data.addresses);
        setLookupState('results');
        setShowDropdown(true);
        // Save the validated postcode
        onAddressChange({ ...addressData, postcode: data.postcode || formatPostcode(postcodeInput) });
      } else {
        // No addresses found - show message and allow manual entry
        console.log('No addresses found for postcode:', postcodeInput);
        setApiError('No addresses found for this postcode. Please enter your address manually below.');
        setLookupState('manual');
        onAddressChange({ ...addressData, postcode: formatPostcode(postcodeInput) });
      }
    } catch (err) {
      console.error('Postcode lookup failed:', err);
      setApiError('Address lookup failed. Please enter your address manually.');
      setLookupState('manual');
      onAddressChange({ ...addressData, postcode: formatPostcode(postcodeInput) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAddress = (index: number) => {
    setSelectedAddressIndex(index);
    setShowDropdown(false);
    
    const addr = cachedAddresses[index];
    if (!addr) return;

    // Build address_line_1 from components
    const line1Parts = [
      addr.building_number,
      addr.building_name,
      addr.thoroughfare || addr.line_1
    ].filter(Boolean).join(' ').trim() || addr.line_1 || '';

    const newAddressData: AddressData = {
      postcode: addr.postcode || addressData.postcode || formatPostcode(postcodeInput),
      address_line_1: line1Parts,
      address_line_2: addr.line_2 || addr.sub_building_name || '',
      town: addr.town_or_city || addr.locality || '',
      county: addr.county || '',
    };

    onAddressChange(newAddressData);
    setLookupState('complete');
  };

  const getDisplayAddress = (addr: ExpandedAddress): string => {
    if (addr.formatted_address && Array.isArray(addr.formatted_address)) {
      return addr.formatted_address.filter(Boolean).join(', ');
    }
    return [addr.line_1, addr.line_2, addr.town_or_city].filter(Boolean).join(', ');
  };

  const handleEnterManually = () => {
    setLookupState('manual');
    setShowDropdown(false);
    setApiError('');
    // Keep the postcode if it's valid
    if (isValidUKPostcode(postcodeInput)) {
      onAddressChange({ ...addressData, postcode: formatPostcode(postcodeInput) });
    }
  };

  const handleChangePostcode = () => {
    setLookupState('initial');
    setCachedAddresses([]);
    setSelectedAddressIndex(null);
    setShowDropdown(false);
    setApiError('');
  };

  const getInputClass = (field: string) => {
    if (showValidation && addressErrors[field]) {
      return 'border-red-500 ring-2 ring-red-200 bg-red-50/50 focus:ring-red-300 focus:border-red-500';
    }
    if (addressValidated[field]) {
      return 'border-green-500 bg-green-50/30';
    }
    return 'bg-[#F5F5F5] border-gray-200 focus:bg-white';
  };

  // Check if we need to show manual fields
  const showManualFields = lookupState === 'manual' || lookupState === 'complete';

  return (
    <div className="space-y-4">
      {/* Step 1: Postcode Entry */}
      {(lookupState === 'initial' || lookupState === 'loading') && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Enter your postcode <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="postcode-lookup"
                type="text"
                value={postcodeInput}
                onChange={(e) => handlePostcodeChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFindAddress()}
                placeholder="e.g. SW1A 1AA"
                maxLength={8}
                className={cn(
                  "h-12 text-base font-medium uppercase tracking-wider bg-[#F5F5F5] border-gray-200 focus:bg-white transition-colors",
                  postcodeError && "border-red-500"
                )}
                disabled={isLoading}
              />
              {isValidUKPostcode(postcodeInput) && !isLoading && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
            </div>
            <Button
              type="button"
              onClick={handleFindAddress}
              disabled={isLoading || !postcodeInput.trim()}
              className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find Address
                </>
              )}
            </Button>
          </div>
          {postcodeError && (
            <p className="text-destructive text-sm flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {postcodeError}
            </p>
          )}
          <button
            type="button"
            onClick={handleEnterManually}
            className="text-sm text-primary hover:underline font-medium"
          >
            Enter address manually
          </button>
        </div>
      )}

      {/* Step 2: Address Selection */}
      {lookupState === 'results' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Postcode: <span className="font-bold">{formatPostcode(postcodeInput)}</span>
            </Label>
            <button
              type="button"
              onClick={handleChangePostcode}
              className="text-sm text-primary hover:underline"
            >
              Change
            </button>
          </div>

          {/* Address dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                "w-full h-12 px-4 flex items-center justify-between bg-[#F5F5F5] border border-gray-200 rounded-lg text-left transition-colors hover:bg-gray-100",
                showDropdown && "ring-2 ring-primary/20"
              )}
            >
              <span className={selectedAddressIndex !== null ? "text-foreground font-medium" : "text-muted-foreground"}>
                {selectedAddressIndex !== null 
                  ? getDisplayAddress(cachedAddresses[selectedAddressIndex]) 
                  : `Select from ${cachedAddresses.length} addresses found`}
              </span>
              <ChevronDown className={cn("w-5 h-5 transition-transform", showDropdown && "rotate-180")} />
            </button>

            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {cachedAddresses.map((addr, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectAddress(index)}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm hover:bg-accent transition-colors",
                      index === selectedAddressIndex && "bg-accent",
                      index !== cachedAddresses.length - 1 && "border-b border-gray-100"
                    )}
                  >
                    {getDisplayAddress(addr)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleEnterManually}
            className="text-sm text-primary hover:underline font-medium"
          >
            I can't find my address
          </button>
        </div>
      )}

      {/* Step 3: Manual Entry / Complete View */}
      {showManualFields && (
        <div className="space-y-4">
          {/* Postcode display (read-only style) */}
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-medium text-foreground">
                Postcode: {addressData.postcode || formatPostcode(postcodeInput)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleChangePostcode}
              className="text-sm text-primary hover:underline"
            >
              Change
            </button>
          </div>

          {/* Address Line 1 */}
          <div>
            <Label htmlFor="address_line_1" className="text-sm font-medium text-foreground/80">
              Address Line 1 <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1">
              <Input
                id="address_line_1"
                placeholder="e.g. 123 High Street"
                value={addressData.address_line_1}
                onChange={(e) => onAddressChange({ ...addressData, address_line_1: e.target.value })}
                onBlur={() => onValidateField('address_line_1')}
                className={cn("h-11 text-sm pr-10 transition-colors", getInputClass('address_line_1'))}
              />
              {addressValidated.address_line_1 && !addressErrors.address_line_1 && addressData.address_line_1 && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
            </div>
            {showValidation && addressErrors.address_line_1 && (
              <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {addressErrors.address_line_1}
              </p>
            )}
          </div>

          {/* Address Line 2 (optional) */}
          <div>
            <Label htmlFor="address_line_2" className="text-sm font-medium text-foreground/80">
              Address Line 2 <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="address_line_2"
              placeholder="e.g. Flat 2, Oak House"
              value={addressData.address_line_2}
              onChange={(e) => onAddressChange({ ...addressData, address_line_2: e.target.value })}
              className="h-11 text-sm mt-1 bg-[#F5F5F5] border-gray-200 focus:bg-white transition-colors"
            />
          </div>

          {/* Town/City */}
          <div>
            <Label htmlFor="town" className="text-sm font-medium text-foreground/80">
              Town / City <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1">
              <Input
                id="town"
                placeholder="e.g. London"
                value={addressData.town}
                onChange={(e) => onAddressChange({ ...addressData, town: e.target.value })}
                onBlur={() => onValidateField('town')}
                className={cn("h-11 text-sm pr-10 transition-colors", getInputClass('town'))}
              />
              {addressValidated.town && !addressErrors.town && addressData.town && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
            </div>
            {showValidation && addressErrors.town && (
              <p className="text-destructive text-sm mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {addressErrors.town}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostcodeFirstAddressLookup;
