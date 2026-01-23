import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  // Debug mount
  console.log('[AddressAutocomplete] Component mounting/rendering');
  // IMPORTANT: Never clear inputValue except when user types - this preserves partial entries
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
  const isSelectingRef = useRef(false); // Prevent closing during selection

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

    console.log('[AddressAutocomplete] Fetching suggestions for:', term);
    setIsLoading(true);
    // Don't reset lookupFailed here - only set it on actual failure
    
    try {
      console.log('[AddressAutocomplete] Calling supabase edge function...');
      const { data, error } = await supabase.functions.invoke('getaddress-lookup', {
        body: { action: 'autocomplete', term }
      });
      
      console.log('[AddressAutocomplete] Response:', { data, error });

      if (error) {
        // API call failed - show fallback message but NEVER clear input
        console.error('[AddressAutocomplete] Error fetching suggestions:', error);
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
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // CRITICAL DEBUG: Log immediately on any input
    console.log('[AddressAutocomplete] handleInputChange TRIGGERED - value:', value, 'length:', value.length);
    
    setInputValue(value); // Always preserve what user types
    setHasSelected(false);
    setSelectedIndex(-1);
    
    // Reset lookup failed state when user clears input or starts fresh
    if (value.length < 3) {
      setLookupFailed(false);
      onLookupError?.(false);
      setSuggestions([]);
      setShowDropdown(false);
      console.log('[AddressAutocomplete] Input too short, clearing suggestions');
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      console.log('[AddressAutocomplete] Cleared previous debounce');
    }

    // Debounce API call - only if they've typed enough
    console.log('[AddressAutocomplete] Setting debounce timer for:', value);
    debounceRef.current = setTimeout(() => {
      console.log('[AddressAutocomplete] Debounce complete, calling fetchSuggestions for:', value);
      fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions, onLookupError]);

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

  // Debug: log on every render to confirm component is alive
  console.log('[AddressAutocomplete] RENDER - inputValue:', inputValue, 'disabled:', disabled);

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          name={`address-search-${Math.random().toString(36).slice(2, 9)}`}
          value={inputValue}
          onChange={(e) => {
            console.log('[AddressAutocomplete] onChange fired:', e.target.value);
            handleInputChange(e);
          }}
          onInput={(e) => {
            // Safari fix: onInput is more reliable on Safari/Mac
            const target = e.target as HTMLInputElement;
            const newValue = target.value;
            console.log('[AddressAutocomplete] onInput fired:', newValue);
            
            // Only process if value actually changed (prevents double-firing)
            if (newValue !== inputValue) {
              setInputValue(newValue);
              setHasSelected(false);
              setSelectedIndex(-1);
              
              if (newValue.length < 3) {
                setLookupFailed(false);
                onLookupError?.(false);
                setSuggestions([]);
                setShowDropdown(false);
                return;
              }
              
              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
              }
              
              debounceRef.current = setTimeout(() => {
                console.log('[AddressAutocomplete] Triggering fetch from onInput for:', newValue);
                fetchSuggestions(newValue);
              }, 300);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            console.log('[AddressAutocomplete] Input focused');
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
            "flex h-10 w-full rounded-md border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-9",
            error && "border-destructive",
            lookupFailed && !error && "border-amber-400",
            className
          )}
          disabled={disabled}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
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
          onMouseDown={(e) => {
            // Prevent any mousedown from bubbling and closing dropdown
            e.preventDefault();
          }}
        >
          {suggestions.map((suggestion, index) => {
            // Use a ref to track if this specific item was touched
            const handleSelection = () => {
              isSelectingRef.current = true;
              handleSelectAddress(suggestion);
              setTimeout(() => { isSelectingRef.current = false; }, 500);
            };

            return (
              <div
                key={suggestion.id || index}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full px-4 py-4 text-left text-sm hover:bg-accent active:bg-accent transition-colors cursor-pointer select-none",
                  index === selectedIndex && "bg-accent",
                  index !== suggestions.length - 1 && "border-b border-border/50"
                )}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelection();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelection();
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent blur on input before click completes (Safari/iOS fix)
                  e.preventDefault();
                  e.stopPropagation();
                  isSelectingRef.current = true;
                }}
              >
                <span className="text-foreground">{suggestion.address}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
