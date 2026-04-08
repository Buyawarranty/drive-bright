

## Plan: Restrict Sales Agent Search to Key Fields Only

**Problem**: Sales agents can currently search across all customer fields (address, vehicle details, warranty numbers, stripe IDs, etc.). They should only be able to search by **name, email, phone number, or registration plate** — and still be able to find any customer, not just their own.

### Change

**File: `src/components/admin/CustomersTab.tsx`** (~lines 608-646)

Wrap the search filter in a role check:
- For `sales` and `sales_lead` roles: restrict search to only match against `name`, `first_name`, `last_name`, `email`, `phone`, and `registration_plate`
- For all other roles: keep the existing comprehensive search across all fields

The existing `isSalesSearching` bypass (line 730-733) already handles removing the agent filter when sales users search, so no changes needed there.

### Result
- Sales agents can search any customer by name, email, phone, or reg plate
- They cannot search by address, warranty number, stripe ID, or other sensitive fields
- Admins retain full search capability across all fields

