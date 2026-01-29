import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface AddressData {
  line_1: string;
  line_2: string;
  town: string;
  county: string;
  postcode: string;
  building_number?: string;
  building_name?: string;
}

interface AutocompleteSuggestion {
  address: string;
  url: string;
  id: string;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: AddressData) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  initialValue?: string;
  disabled?: boolean;
  onLookupError?: (hasError: boolean) => void;
  onPostcodeValidation?: (isValid: boolean, postcode: string) => void;
}

// UK postcode validation regex
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;

const isValidUKPostcode = (postcode: string): boolean => {
  return UK_POSTCODE_REGEX.test(postcode.replace(/\s/g, ''));
};

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onAddressSelect,
  placeholder = "Start typing postcode or address...",
  className,
  error,
  initialValue = "",
  disabled = false,
  onLookupError,
  onPostcodeValidation,
}) => {
  // IMPORTANT: Never clear inputValue except when user types - this preserves partial entries
  const [inputValue, setInputValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [postcodeValid, setPostcodeValid] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const isSelectingRef = useRef(false); // Prevent closing during selection

  // Check postcode validity whenever input changes
  useEffect(() => {
    const isValid = isValidUKPostcode(inputValue);
    setPostcodeValid(isValid);
    onPostcodeValidation?.(isValid, inputValue);
  }, [inputValue, onPostcodeValidation]);

  // Close dropdown when clicking/tapping outside (iOS/Safari compatible)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Don't close if we're in the middle of a selection
      if (isSelectingRef.current) return;
      
      try {
        const target = event.target as Node;
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(target) &&
          inputRef.current &&
          !inputRef.current.contains(target)
        ) {
          setShowDropdown(false);
        }
      } catch (err) {
        // Silently handle any errors - never crash
        setShowDropdown(false);
      }
    };

    // Add both mouse and touch events for iOS/Safari compatibility
    // Using 'capture: true' ensures we catch events before they bubble
    document.addEventListener('mousedown', handleClickOutside, { passive: true, capture: false });
    document.addEventListener('touchstart', handleClickOutside, { passive: true, capture: false });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Fetch suggestions from getaddress.io via edge function
  // IMPORTANT: This function NEVER clears or modifies inputValue
  const fetchSuggestions = useCallback(async (term: string) => {
    // Don't search for very short terms
    if (term.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      // Don't show error for short terms - user is still typing
      return;
    }

    setIsLoading(true);
    // Don't reset lookupFailed here - only set it on actual failure
    
    try {
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'autocomplete', term }
      });

      if (error) {
        // API call failed - show fallback message but NEVER clear input
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setLookupFailed(true);
        onLookupError?.(true);
      } else if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        // Success - show suggestions
        setSuggestions(data.suggestions);
        setShowDropdown(true);
        setLookupFailed(false);
        onLookupError?.(false);
      } else if (data?.error) {
        // API returned an error (e.g., credit issues, invalid key)
        console.error('API error:', data.error);
        setSuggestions([]);
        setLookupFailed(true);
        onLookupError?.(true);
      } else {
        // No suggestions found - this is NOT an error, just no results
        setSuggestions([]);
        setShowDropdown(false);
        // Only show fallback message if they've typed a reasonably complete postcode
        if (term.length >= 5) {
          setLookupFailed(true);
          onLookupError?.(true);
        }
      }
    } catch (err) {
      // Catch any unexpected errors - NEVER crash, NEVER clear input
      console.error('Error in fetchSuggestions:', err);
      setSuggestions([]);
      setLookupFailed(true);
      onLookupError?.(true);
    } finally {
      setIsLoading(false);
    }
  }, [onLookupError]);

  // Handle input change with debounce
  // IMPORTANT: User input is ALWAYS preserved - we only update inputValue, never clear it
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const value = e.target.value;
      setInputValue(value); // Always preserve what user types
      setHasSelected(false);
      setSelectedIndex(-1);
      
      // Reset lookup failed state when user clears input or starts fresh
      if (value.length < 3) {
        setLookupFailed(false);
        onLookupError?.(false);
        setSuggestions([]);
        setShowDropdown(false);
      }

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce API call - only if they've typed enough
      if (value.length >= 3) {
        debounceRef.current = setTimeout(() => {
          fetchSuggestions(value);
        }, 300);
      }
    } catch (err) {
      // Never crash on input change
      console.error('Error in handleInputChange:', err);
    }
  };

  // Fetch full address details when user selects a suggestion
  // IMPORTANT: If this fails, we keep whatever the user typed - never clear
  const handleSelectAddress = async (suggestion: AutocompleteSuggestion) => {
    setIsLoading(true);
    setShowDropdown(false);
    
    // Update display value to show selected address
    setInputValue(suggestion.address);

    try {
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'get', id: suggestion.id }
      });

      if (error) {
        // Failed to get details - but keep the address text they selected
        console.error('Error fetching address details:', error);
        setLookupFailed(true);
        onLookupError?.(true);
        // Don't return - user can still manually fill fields
      } else if (data) {
        // Success - populate the form
        const addressData: AddressData = {
          line_1: data.line_1 || '',
          line_2: data.line_2 || '',
          town: data.town_or_city || '',
          county: data.county || '',
          postcode: data.postcode || '',
          building_number: data.building_number || '',
          building_name: data.building_name || '',
        };

        setHasSelected(true);
        setLookupFailed(false);
        onLookupError?.(false);
        onAddressSelect(addressData);
      }
    } catch (err) {
      // Catch any errors - NEVER crash, keep user's selection visible
      console.error('Error in handleSelectAddress:', err);
      setLookupFailed(true);
      onLookupError?.(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    try {
      if (!showDropdown || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelectAddress(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setSelectedIndex(-1);
          break;
      }
    } catch (err) {
      // Never crash on keyboard events
      console.error('Error in handleKeyDown:', err);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            try {
              if (suggestions.length > 0 && !hasSelected) {
                setShowDropdown(true);
              }
            } catch (err) {
              // Never crash on focus
            }
          }}
          placeholder={placeholder}
          className={cn(
            "pr-9",
            error && "border-destructive",
            lookupFailed && !error && "border-amber-400",
            className
          )}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasSelected && !isLoading && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
        {/* Show green tick for valid postcode when lookup failed but postcode format is correct */}
        {lookupFailed && !isLoading && !hasSelected && postcodeValid && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
        {lookupFailed && !isLoading && !hasSelected && !postcodeValid && inputValue.length > 2 && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {/* Lookup Failed Fallback Message - Friendly, non-blocking */}
      {lookupFailed && !hasSelected && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              We couldn't retrieve your address at the moment. Please enter it manually below.
            </p>
          </div>
        </div>
      )}

      {/* Dropdown - iOS/Safari optimized with robust touch handling */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id || index}
              type="button"
              className={cn(
                "w-full px-4 py-4 text-left text-sm hover:bg-accent active:bg-accent transition-colors touch-manipulation cursor-pointer select-none",
                index === selectedIndex && "bg-accent",
                index !== suggestions.length - 1 && "border-b border-border/50"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isSelectingRef.current = true;
                handleSelectAddress(suggestion);
                // Reset after a small delay
                setTimeout(() => { isSelectingRef.current = false; }, 300);
              }}
              onMouseDown={(e) => {
                // Prevent blur on input before click completes (Safari fix)
                e.preventDefault();
                isSelectingRef.current = true;
              }}
              onMouseUp={() => {
                setTimeout(() => { isSelectingRef.current = false; }, 300);
              }}
              onTouchStart={(e) => {
                // Mark that we're selecting to prevent dropdown close
                isSelectingRef.current = true;
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectAddress(suggestion);
                // Reset after selection completes
                setTimeout(() => { isSelectingRef.current = false; }, 300);
              }}
            >
              <span className="text-foreground">{suggestion.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
