import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronDown } from 'lucide-react';

interface Address {
  formatted_address: string;
  line_1: string;
  line_2?: string;
  town_or_city: string;
  county: string;
  postcode: string;
}

interface PostcodeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: {
    street: string;
    building_name: string;
    town: string;
    county: string;
    postcode: string;
  }) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
}

export const PostcodeAutocomplete: React.FC<PostcodeAutocompleteProps> = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter UK postcode",
  required = false,
  className = "",
  error
}) => {
  const [suggestions, setSuggestions] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // UK postcode validation regex
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

  const validatePostcode = (postcode: string): boolean => {
    return ukPostcodeRegex.test(postcode.replace(/\s/g, ''));
  };

  const formatPostcode = (postcode: string): string => {
    const cleaned = postcode.replace(/\s/g, '').toUpperCase();
    if (cleaned.length <= 4) return cleaned;
    return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
  };

  const searchAddresses = async (postcode: string) => {
    if (!validatePostcode(postcode)) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // Using UK Government's postcode API (free service)
      const response = await fetch(`https://api.postcodes.io/postcodes/${postcode.replace(/\s/g, '')}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          // Create a mock address structure based on postcode data
          const mockAddresses: Address[] = [
            {
              formatted_address: `${data.result.postcode}, ${data.result.admin_district}, ${data.result.country}`,
              line_1: "", // User will need to fill this
              town_or_city: data.result.admin_district || data.result.parish || "",
              county: data.result.admin_county || data.result.region || "",
              postcode: data.result.postcode
            }
          ];
          setSuggestions(mockAddresses);
        }
      } else {
        // Fallback: create basic structure from user input
        const formattedPostcode = formatPostcode(postcode);
        setSuggestions([{
          formatted_address: formattedPostcode,
          line_1: "",
          town_or_city: "",
          county: "",
          postcode: formattedPostcode
        }]);
      }
    } catch (error) {
      console.error('Postcode lookup error:', error);
      // Fallback: create basic structure from user input
      const formattedPostcode = formatPostcode(postcode);
      setSuggestions([{
        formatted_address: formattedPostcode,
        line_1: "",
        town_or_city: "",
        county: "",
        postcode: formattedPostcode
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Only search if we have a reasonable postcode length
    if (newValue.length >= 3) {
      const timeout = setTimeout(() => {
        searchAddresses(newValue);
        setShowSuggestions(true);
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleAddressSelect = (address: Address) => {
    onChange(address.postcode);
    setShowSuggestions(false);
    
    onAddressSelect({
      street: address.line_1,
      building_name: address.line_2 || "",
      town: address.town_or_city,
      county: address.county,
      postcode: address.postcode
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          required={required}
          className={`pr-10 ${error ? 'border-red-500 focus:border-red-500' : ''} ${className}`}
          maxLength={8}
          autoComplete="postal-code"
          name="postcode"
          id="postcode"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((address, index) => (
            <div
              key={index}
              onClick={() => handleAddressSelect(address)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900">{address.postcode}</div>
                  <div className="text-sm text-gray-600">
                    {address.town_or_city && `${address.town_or_city}, `}
                    {address.county}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {value && validatePostcode(value) && (
        <p className="text-xs text-green-600 mt-1 flex items-center">
          <MapPin className="h-3 w-3 mr-1" />
          Valid UK postcode
        </p>
      )}
      
      {value && !validatePostcode(value) && value.length > 2 && (
        <p className="text-xs text-amber-600 mt-1">
          Please enter a valid UK postcode (e.g., SW1A 1AA)
        </p>
      )}
    </div>
  );
};

export default PostcodeAutocomplete;