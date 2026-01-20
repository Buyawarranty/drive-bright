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
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onAddressSelect,
  placeholder = "Start typing postcode or address...",
  className,
  error,
  initialValue = "",
  disabled = false,
  onLookupError,
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdown when clicking/tapping outside (iOS/Safari compatible)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };

    // Add both mouse and touch events for iOS/Safari compatibility
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Fetch suggestions from getaddress.io via edge function
  const fetchSuggestions = useCallback(async (term: string) => {
    if (term.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    setLookupFailed(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'autocomplete', term }
      });

      if (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setLookupFailed(true);
        onLookupError?.(true);
      } else if (data?.suggestions && data.suggestions.length > 0) {
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
        // No suggestions found
        setSuggestions([]);
        if (term.length >= 5) {
          // Only show as "failed" if they've typed enough for a valid postcode
          setLookupFailed(true);
          onLookupError?.(true);
        }
      }
    } catch (err) {
      console.error('Error in fetchSuggestions:', err);
      setSuggestions([]);
      setLookupFailed(true);
      onLookupError?.(true);
    } finally {
      setIsLoading(false);
    }
  }, [onLookupError]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setHasSelected(false);
    setSelectedIndex(-1);
    
    // Reset lookup failed state when user clears input
    if (value.length < 3) {
      setLookupFailed(false);
      onLookupError?.(false);
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API call
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Fetch full address details when user selects a suggestion
  const handleSelectAddress = async (suggestion: AutocompleteSuggestion) => {
    setIsLoading(true);
    setShowDropdown(false);
    setInputValue(suggestion.address);

    try {
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'get', id: suggestion.id }
      });

      if (error) {
        console.error('Error fetching address details:', error);
        setLookupFailed(true);
        onLookupError?.(true);
        return;
      }

      if (data) {
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
      console.error('Error in handleSelectAddress:', err);
      setLookupFailed(true);
      onLookupError?.(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
            if (suggestions.length > 0 && !hasSelected) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className={cn(
            "pr-9",
            error && "border-destructive",
            lookupFailed && "border-amber-400",
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
        {lookupFailed && !isLoading && !hasSelected && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {/* Lookup Failed Fallback Message */}
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

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={cn(
                "w-full px-3 py-3 text-left text-sm hover:bg-accent active:bg-accent transition-colors touch-manipulation cursor-pointer select-none",
                index === selectedIndex && "bg-accent",
                index !== suggestions.length - 1 && "border-b border-border/50"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectAddress(suggestion);
              }}
              onMouseDown={(e) => {
                // Prevent blur on input before click completes (Safari fix)
                e.preventDefault();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectAddress(suggestion);
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
