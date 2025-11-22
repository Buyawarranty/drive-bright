# Warranties 2000 Data Issues Analysis & Solutions

## Problem Summary

Based on the Warranties 2000 API screenshot analysis, we identified several critical data integrity issues:

### 1. **Duplicate Registration Plates with Different Vehicle Data**
- Same reg plate `SJ17 DRW` appears with different makes: AUDI vs RENAULT
- Same reg plate `LK14 HPN` appears with: AUDI A4 vs TOYOTA Unknown
- Same reg plate `HK21 PMU` appears twice with FORD
- Same reg plate `AB12 CDE` appears twice with Ford Focus

### 2. **Test Data Contamination**
- Clear test entries: "Test", "slack", "Qureshi", "TAND BAND", "Monshot", "LIMITED"
- Test registration plates like `AB12 CDE`, `TEST123`
- Generic/fake customer names

### 3. **Missing Vehicle Information**
- Many entries show "Unknown" for vehicle model
- Engine size field empty (causing validation failures)
- Missing MOT due dates

## Root Cause Analysis

### Data Source Issues
Our integration pulls vehicle data from the `customers` table:
```sql
SELECT vehicle_make, vehicle_model, registration_plate, mileage
FROM customers
```

**Problems identified:**
1. **Test data pollution** - Test customers with fake data being sent to live API
2. **Incomplete vehicle lookups** - DVLA lookups failing or returning incomplete data
3. **No deduplication** - Same registration plates allowed for multiple customers
4. **Missing engine size** - Not captured in our schema

### Integration Logic Flaws
1. No validation to prevent test data reaching live API
2. No duplicate registration checking
3. Missing required fields for Warranties 2000 API compliance

## Solutions Implemented

### 1. **Test Data Prevention** ✅
Added comprehensive test data detection in `send-to-warranties-2000` function:
```javascript
const testIndicators = [
  'test', 'slack', 'qureshi', 'guest', 'demo', 'unknown', 'tand band',
  'ab12', 'test123', 'monshot', 'limited', 'qureshitest', 'threeyear'
];
```

### 2. **Duplicate Registration Prevention** ✅
Added duplicate registration checking before sending to API:
```javascript
// Check for duplicate registration across all customers
const duplicateRegistrations = await supabase
  .from('customer_policies')
  .select('id, warranty_number, warranties_2000_status, customers!customer_id(registration_plate)')
  .neq('id', policy.id)
  .eq('warranties_2000_status', 'sent');
```

### 3. **Enhanced Validation** ✅
- Block test data with specific status: `blocked_test_data`
- Return detailed error messages for duplicates
- Log all blocked attempts for monitoring

## Recommended Next Steps

### 1. **Database Cleanup** 🚨 URGENT
```sql
-- Remove test data from customer_policies
DELETE FROM customer_policies 
WHERE email ILIKE '%test%' 
   OR email ILIKE '%slack%' 
   OR email ILIKE '%qureshi%'
   OR customer_full_name ILIKE '%test%';

-- Remove test customers
DELETE FROM customers 
WHERE email ILIKE '%test%' 
   OR name ILIKE '%test%'
   OR name ILIKE '%slack%'
   OR name ILIKE '%qureshi%';
```

### 2. **Schema Enhancements**
Add missing fields to support Warranties 2000 requirements:
```sql
ALTER TABLE customers 
ADD COLUMN engine_size VARCHAR(10),
ADD COLUMN mot_due_date DATE,
ADD COLUMN purchase_price DECIMAL(10,2);

-- Add unique constraint on registration plates
ALTER TABLE customers 
ADD CONSTRAINT unique_registration_per_active_policy 
EXCLUDE (registration_plate WITH =) 
WHERE (status = 'Active');
```

### 3. **DVLA Integration Enhancement**
Improve vehicle data capture to include:
- Engine size from DVLA API
- More accurate make/model data
- Validation against known manufacturers

### 4. **Admin Dashboard Improvements**
Add data quality indicators:
- Flag incomplete vehicle data
- Highlight potential duplicates
- Show Warranties 2000 sync status

### 5. **Monitoring & Alerts**
Implement:
- Daily data quality reports
- Duplicate registration alerts
- Failed Warranties 2000 submissions monitoring

## Data Quality Checklist

Before sending any data to Warranties 2000:
- [ ] Customer name is not test data
- [ ] Registration plate is valid UK format
- [ ] Vehicle make/model are populated
- [ ] No duplicate registrations exist
- [ ] Engine size is captured
- [ ] Purchase price is reasonable

## Contact Warranties 2000

Share the updated `WARRANTIES_2000_API_ISSUES_SOLUTION.md` document with them, highlighting:
1. Data format clarifications needed
2. Validation error improvements
3. Test environment request
4. Our data quality improvements

This will demonstrate our commitment to data integrity and help them provide better API documentation.