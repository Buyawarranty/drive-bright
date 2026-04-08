

## Plan: Allow Sales Agents to Search All Customers

**Problem**: Sales agents (`sales` and `sales_lead` roles) currently have their agent filter auto-locked to their own ID (line 569-571 in `CustomersTab.tsx`). This means they can only see customers assigned to them, even when searching.

**Solution**: When a sales agent types a search query, temporarily bypass the agent filter so they can find any customer across the entire database. When the search is cleared, revert to showing only their own customers.

### Changes

**File: `src/components/admin/CustomersTab.tsx`**

1. **Modify `applyFiltersAndSort`** (~line 728-735): Add a condition so that when there's an active search term AND the user is a `sales` or `sales_lead`, the agent filter is skipped. This lets them search across all customers.

   ```
   // Apply agent filter — skip when sales/sales_lead is actively searching
   const isSalesSearching = debouncedSearchTerm && 
     (currentAdminUser?.role === 'sales' || currentAdminUser?.role === 'sales_lead');
   
   if (filterByAgent !== 'all' && !isSalesSearching) {
     // existing filter logic
   }
   ```

2. **Add `currentAdminUser` to the dependency array** of `applyFiltersAndSort` useCallback (~line 790) to ensure it reacts to the user context.

This is a minimal, targeted change — no new components, no database changes. Sales agents see only their customers by default, but can search and find any customer when they need to.

