import React, { createContext, useContext, useState, useEffect } from 'react';
import { isStorageAvailable } from '@/utils/localStorage';

export interface CartItem {
  id: string;
  vehicleData: {
    regNumber: string;
    mileage: string;
    make?: string;
    model?: string;
    year?: string;
    vehicleType?: string;
  };
  planId: string;
  planName: string;
  paymentType: string;
  pricingData: {
    totalPrice: number;
    monthlyPrice: number;
    voluntaryExcess: number;
    claimLimit?: number;
    selectedAddOns: {[addon: string]: boolean};
  };
  addedAt: Date;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
  hasRegistration: (regNumber: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL: Initialize cart from localStorage SYNCHRONOUSLY to prevent race conditions
  // when returning from external payment gateways (Stripe, Bumper)
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      if (!isStorageAvailable('localStorage')) {
        console.warn('⚠️ localStorage not available - cart will not persist');
        return [];
      }
      
      const savedCart = localStorage.getItem('warrantyCart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (parsedCart && parsedCart.length > 0) {
          console.log('✅ Cart initialized synchronously from localStorage:', parsedCart.length, 'items');
          return parsedCart.map((item: any) => ({
            ...item,
            addedAt: new Date(item.addedAt)
          }));
        }
      }
      console.log('ℹ️ No cart data found in localStorage');
      return [];
    } catch (error) {
      console.error('❌ Error loading cart:', error);
      return [];
    }
  });
  
  const [isInitialized, setIsInitialized] = useState(true);

  // Handle bfcache restoration - force re-read from localStorage when returning from payment gateway
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 CartContext: Page restored from bfcache, re-syncing cart');
        try {
          const savedCart = localStorage.getItem('warrantyCart');
          if (savedCart) {
            const parsedCart = JSON.parse(savedCart);
            if (parsedCart && parsedCart.length > 0) {
              console.log('✅ Cart re-synced from bfcache:', parsedCart.length, 'items');
              setItems(parsedCart.map((item: any) => ({
                ...item,
                addedAt: new Date(item.addedAt)
              })));
            }
          }
        } catch (error) {
          console.error('❌ Error re-syncing cart from bfcache:', error);
        }
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-sync cart when page becomes visible (returning from Stripe)
        try {
          const savedCart = localStorage.getItem('warrantyCart');
          if (savedCart) {
            const parsedCart = JSON.parse(savedCart);
            if (parsedCart && Array.isArray(parsedCart)) {
              const mappedCart = parsedCart.map((item: any) => ({
                ...item,
                addedAt: new Date(item.addedAt)
              }));
              // Only update if different to prevent unnecessary re-renders
              setItems(prev => {
                if (JSON.stringify(prev.map(i => i.id)) !== JSON.stringify(mappedCart.map(i => i.id))) {
                  console.log('✅ Cart re-synced on visibility change');
                  return mappedCart;
                }
                return prev;
              });
            }
          }
        } catch (error) {
          console.error('❌ Error re-syncing cart on visibility:', error);
        }
      }
    };
    
    window.addEventListener('pageshow', handlePageShow as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Save cart to localStorage whenever items change (skip if empty on first render to avoid clearing valid data)
  useEffect(() => {
    if (!isStorageAvailable('localStorage')) {
      return;
    }
    
    try {
      // Only save if we have items OR if this is not the initial empty state
      if (items.length > 0 || isInitialized) {
        localStorage.setItem('warrantyCart', JSON.stringify(items));
      }
    } catch (error) {
      console.error('❌ Error saving cart to localStorage:', error);
    }
  }, [items, isInitialized]);

  const addToCart = (item: Omit<CartItem, 'id' | 'addedAt'>) => {
    // Check if registration plate already exists in cart
    const existingReg = items.find(cartItem => 
      cartItem.vehicleData.regNumber.replace(/\s/g, '').toLowerCase() === 
      item.vehicleData.regNumber.replace(/\s/g, '').toLowerCase()
    );
    
    if (existingReg) {
      throw new Error(`A warranty for registration ${item.vehicleData.regNumber} is already in your cart. We can only provide one warranty per vehicle.`);
    }
    
    // Check for "add another warranty" discount from previous purchase
    let hasAddAnotherWarrantyDiscount = false;
    try {
      hasAddAnotherWarrantyDiscount = isStorageAvailable('localStorage') && 
        localStorage.getItem('addAnotherWarrantyDiscount') === 'true';
    } catch (error) {
      console.error('❌ Error checking discount flag:', error);
    }
    
    // Apply 10% discount ONLY if user has "add another warranty" discount from previous purchase
    const shouldApplyDiscount = hasAddAnotherWarrantyDiscount;
    let adjustedItem = { ...item };
    
    // Debug logging
    console.log('CartContext Debug - addToCart:', {
      regNumber: item.vehicleData.regNumber,
      currentItemsCount: items.length,
      hasAddAnotherWarrantyDiscount,
      shouldApplyDiscount,
      originalPrice: item.pricingData.totalPrice
    });
    
    if (shouldApplyDiscount) {
      // Apply 10% discount to the pricing
      const discountMultiplier = 0.9; // 10% off
      adjustedItem.pricingData = {
        ...item.pricingData,
        totalPrice: item.pricingData.totalPrice * discountMultiplier,
        monthlyPrice: item.pricingData.monthlyPrice * discountMultiplier
      };
      
      // Clear the localStorage flag after using it
      if (hasAddAnotherWarrantyDiscount) {
        try {
          localStorage.removeItem('addAnotherWarrantyDiscount');
        } catch (error) {
          console.error('❌ Error removing discount flag:', error);
        }
      }
    }
    
    const newItem: CartItem = {
      ...adjustedItem,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      addedAt: new Date()
    };
    
    setItems(prev => [...prev, newItem]);
  };

  const removeFromCart = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateCartItem = (itemId: string, updates: Partial<CartItem>) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const clearCart = () => {
    setItems([]);
    try {
      if (isStorageAvailable('localStorage')) {
        localStorage.removeItem('warrantyCart');
      }
    } catch (error) {
      console.error('❌ Error clearing cart from localStorage:', error);
    }
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.pricingData.totalPrice, 0);
  };

  const getItemCount = () => {
    return items.length;
  };

  const hasRegistration = (regNumber: string) => {
    return items.some(item => 
      item.vehicleData.regNumber.replace(/\s/g, '').toLowerCase() === 
      regNumber.replace(/\s/g, '').toLowerCase()
    );
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateCartItem,
      clearCart,
      getTotalPrice,
      getItemCount,
      hasRegistration
    }}>
      {children}
    </CartContext.Provider>
  );
};