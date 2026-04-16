

# Fix: Show payment value for accounts role in Payment Method column

## Problem
In the Customers tab Payment Method column, the sale value (e.g. £634.00) is only visible to `super_admin` and `admin` roles. The `accounts` and `accounts_manager` roles cannot see it when logged in directly. The impersonation view also uses `currentAdminUser?.role` instead of `normalizedRole`, so impersonation doesn't accurately simulate what Rezeen actually sees.

## Fix (1 file)

**`src/components/admin/CustomersTab.tsx`** — Line 5045

Change the role check from:
```tsx
(currentAdminUser?.role === 'super_admin' || currentAdminUser?.role === 'admin')
```
to use `normalizedRole` (which respects impersonation) and include accounts roles:
```tsx
(normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'accounts' || normalizedRole === 'accounts_manager')
```

This ensures:
1. Rezeen (accounts) sees the payment value when logged in directly
2. Impersonation accurately simulates the accounts view
3. Sales agents still cannot see payment values (as intended)

