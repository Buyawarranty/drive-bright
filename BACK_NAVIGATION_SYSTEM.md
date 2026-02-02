# Back Navigation Guard System

## Overview

This document describes the back navigation guard system implemented to prevent users from accidentally leaving key journeys (warranty flow, checkout) when using the browser/device back button.

## Components

### 1. BackNavigationConfirmDialog Component
**Location**: `src/components/BackNavigationConfirmDialog.tsx`

An accessible confirmation dialog that appears when users try to leave a guarded journey.

**Features**:
- Built on Radix UI AlertDialog for accessibility
- Keyboard and screen reader friendly
- Clear, non-coercive language
- Two actions: "Stay and Continue" (primary) and "Leave Journey" (secondary)

**Props**:
- `open: boolean` - Controls dialog visibility
- `onStay: () => void` - Called when user chooses to stay
- `onLeave: () => void` - Called when user chooses to leave
- `journeyName?: string` - Customizable journey name (default: "warranty journey")

### 2. useMobileBackNavigation Hook
**Location**: `src/hooks/useMobileBackNavigation.tsx`

Custom React hook that manages back button behavior using the History API.

**Features**:
- Handles popstate events for back/forward navigation
- Shows confirmation dialog only once per step
- Supports internal step navigation without confirmation
- iOS Safari bfcache handling (pageshow/pagehide events)
- Manual scroll restoration
- Analytics tracking for all navigation events

**Props**:
```typescript
{
  currentStep: number;           // Current step in the journey
  onStepChange: (step: number) => void;  // Callback when step changes
  totalSteps: number;            // Total number of steps
  restoreStateFromStep?: (step: number) => void;  // Optional state restoration
  journeyId?: string;            // Identifier for analytics (default: 'warranty-journey')
  isGuarded?: boolean;           // Whether to show confirmation (default: true)
  onShowConfirmDialog?: () => void;  // Callback to show confirmation dialog
}
```

**Returns**:
```typescript
{
  allowLeave: () => void;  // Call this to allow navigation away
  stay: () => void;        // Call this to keep user in journey
}
```

## Implementation

### Main Warranty Journey (Index.tsx)

```typescript
// State for dialog
const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);

// Hook integration
const { allowLeave, stay } = useMobileBackNavigation({
  currentStep,
  onStepChange: handleStepChange,
  totalSteps: 5,
  restoreStateFromStep,
  journeyId: 'warranty-journey',
  isGuarded: currentStep > 1,
  onShowConfirmDialog: () => setShowBackConfirmDialog(true)
});

// Dialog in render
<BackNavigationConfirmDialog
  open={showBackConfirmDialog}
  onStay={() => {
    setShowBackConfirmDialog(false);
    stay();
  }}
  onLeave={() => {
    setShowBackConfirmDialog(false);
    allowLeave();
  }}
  journeyName="warranty journey"
/>
```

### Cart/Checkout Journey (Cart.tsx)

Similar implementation for the cart and checkout flow, with `isGuarded` set to `true` only during checkout.

## How It Works

### Internal Step Navigation
1. User presses back button
2. Hook detects URL step change via popstate
3. If navigating between valid steps (1-5), restores state and updates UI
4. No confirmation dialog shown
5. Analytics event `journey_step_changed` fired

### Leaving Journey (First Attempt)
1. User on step 2+ presses back to go before step 1
2. Hook detects attempt to leave guarded journey
3. Prevents navigation by re-pushing current state
4. Shows confirmation dialog via `onShowConfirmDialog` callback
5. Analytics event `back_intercept_shown` fired

### User Chooses to Stay
1. User clicks "Stay and Continue"
2. Dialog calls `stay()` method
3. Hook re-pushes current state to history
4. Analytics event `back_intercept_stay` fired
5. Reset flag allows showing dialog again if user tries to leave again

### User Chooses to Leave
1. User clicks "Leave Journey"
2. Dialog calls `allowLeave()` method
3. Hook sets internal flag to allow navigation
4. Executes `window.history.back()`
5. Analytics event `back_intercept_leave` fired
6. User navigates to previous site/page

## Browser Compatibility

### History Management
- Uses `pushState` (not `replaceState`) on initial load to preserve external referrer (e.g., Google search)
- Each step navigation creates a new history entry via `pushState`
- This ensures users can navigate back through all steps (4→3→2→1) before leaving the site
- External page (e.g., Google) remains accessible after navigating through all internal steps

### iOS Safari
- Uses `pageshow` and `pagehide` events to handle bfcache
- Resets state when page restored from cache
- No reliance on `beforeunload` custom text (not supported)

### Android Chrome
- Standard popstate handling
- No reliance on `beforeunload` custom text (suppressed on mobile)
- Manual scroll restoration

### Desktop Browsers
- Full support for History API
- Standard popstate and beforeunload events
- Graceful degradation if JavaScript disabled

## Analytics Events

All events include `journey_id` and `step` metadata:

1. **`back_intercept_shown`** - Confirmation dialog displayed
2. **`back_intercept_stay`** - User chose to stay in journey
3. **`back_intercept_leave`** - User chose to leave journey
4. **`journey_step_changed`** - Internal step navigation (includes `from_step`, `to_step`, `direction`)

## Testing

### QA Matrix
- ✅ iOS Safari (current stable)
- ✅ Android Chrome (current stable)
- ✅ Desktop Safari, Chrome, Edge, Firefox
- ✅ Deep linking support
- ✅ Page refresh handling
- ✅ Forward navigation
- ✅ External link navigation

### Test Scenarios

1. **Internal Navigation**: Back between steps should work smoothly without confirmation
2. **First Back From Guarded Step**: Should show confirmation dialog
3. **Stay Decision**: Should keep user on current step, allow future exits
4. **Leave Decision**: Should exit cleanly to previous site
5. **Step 1 Back**: Should allow natural browser back
6. **Page Refresh**: Should restore state correctly
7. **Deep Links**: Should work with step URLs
8. **bfcache**: Should handle iOS Safari bfcache correctly

## Ethical Considerations

✅ **Not a trap**: Users can always leave by clicking "Leave Journey"
✅ **Single confirmation**: Only shows once per step, never repeatedly
✅ **Clear language**: No dark patterns or misleading copy
✅ **Visible exit**: Clear "Leave Journey" button provided
✅ **Respects intent**: Step 1 back navigation is never blocked
✅ **Data preservation**: Progress saved for return visits
✅ **Accessibility**: Fully keyboard and screen reader accessible

## Future Enhancements

Potential improvements:
- Configurable confirmation message per journey type
- A/B testing different messaging strategies
- Session replay integration for UX analysis
- Progressive web app integration
- Multi-language support for confirmation dialog
