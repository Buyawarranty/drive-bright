# Warranties 2000 API Integration Issues - Solution Proposal

**From:** Buy A Warranty Development Team  
**To:** Warranties 2000 Technical Team  
**Date:** August 11, 2025  
**Subject:** API Validation Issues - Data Format Clarification Required

## Issue Summary

We are experiencing validation failures when submitting warranty registrations to your API endpoint (`https://warranties-epf.co.uk/api.php`). The API is returning HTTP 422 responses with the following validation errors:

- **EngSize**: Required value missing
- **MaxClm**: Has an invalid value  
- **Month**: Has an invalid value
- **WarType**: Has an invalid value

## Current Data Format We Are Sending

Based on our analysis, here are the current values we are sending for the problematic fields:

### 1. EngSize (Engine Size)
**Current format:** `"1600"`, `"1.6"`, `"2000"`  
**Question:** What is the expected format?
- Numeric value in CC (e.g., `1600`)?
- Decimal format in litres (e.g., `1.6`)?
- String with units (e.g., `"1.6L"`)?
- Are there specific allowed values or ranges?

### 2. MaxClm (Maximum Claim Amount)
**Current format:** `"500"`, `"1000"`, `"1200"`  
**Question:** What is the expected format?
- Plain numeric string (e.g., `"500"`)?
- Currency format (e.g., `"£500"` or `"500.00"`)?
- Are there specific allowed values for different warranty types?
- Should this be in pence (e.g., `"50000"` for £500)?

### 3. Month (Warranty Duration)
**Current format:** `"1"`, `"12"`, `"24"`, `"36"`  
**Question:** What is the expected format?
- Number of months as string (e.g., `"12"`)?
- Number of months as integer (`12`)?
- Different format altogether?
- Are there specific allowed values?

### 4. WarType (Warranty Type)
**Current format:** `"B-BASIC"`, `"B-GOLD"`, `"B-PLATINUM"`  
**Question:** What are the accepted warranty type codes?
- Should we use `"BASIC"`, `"GOLD"`, `"PLATINUM"`?
- Are there different codes we should be using?
- Is there a complete list of valid warranty type codes?

## Sample Request Data

Here's a complete sample of the JSON payload we are currently sending:

```json
{
  "Title": "Mr",
  "First": "John",
  "Surname": "Smith",
  "Addr1": "123 High Street",
  "Addr2": "",
  "Town": "London",
  "PCode": "SW1A 1AA",
  "Tel": "02012345678",
  "Mobile": "07123456789",
  "EMail": "john.smith@example.com",
  "PurDate": "2025-08-11",
  "Make": "Ford",
  "Model": "Focus",
  "RegNum": "AB12 CDE",
  "Mileage": "50000",
  "EngSize": "1600",      // ← VALIDATION ISSUE
  "PurPrc": "15000",
  "RegDate": "2020-01-01",
  "WarType": "B-BASIC",   // ← VALIDATION ISSUE
  "Month": "12",          // ← VALIDATION ISSUE
  "MaxClm": "500",        // ← VALIDATION ISSUE
  "MOTDue": "2025-12-31",
  "Ref": "BAW-1108-400123"
}
```

## Proposed Solutions

### Option 1: API Documentation Update
Could you provide us with:
1. Complete API documentation with field specifications
2. List of valid values for each enumerated field
3. Data type requirements (string vs. numeric)
4. Example requests that would pass validation

### Option 2: Validation Error Enhancement
Could you enhance the error responses to include:
1. Expected format for each field
2. List of valid values where applicable
3. More specific error messages

Example improved error response:
```json
{
  "Response": "Validation Failed",
  "EngSize": "Expected numeric value in CC (e.g., 1600, 2000)",
  "MaxClm": "Expected one of: 500, 1000, 1200, 1500",
  "Month": "Expected one of: 1, 12, 24, 36",
  "WarType": "Expected one of: BASIC, GOLD, PLATINUM"
}
```

### Option 3: Test Environment
Could you provide a test/sandbox environment where we can:
1. Test different data formats without affecting live data
2. Validate our integration before going live
3. Get immediate feedback on data format issues

## Our Current Integration Status

- **Authentication**: Working correctly with Basic Auth
- **Network connectivity**: Successful
- **Data transmission**: Successful  
- **Issue**: Validation failures on specific fields

## Request for Response

Please could you provide clarification on:

1. **Exact format requirements** for the four problematic fields
2. **Complete list of valid values** for enumerated fields
3. **API documentation** or specification document
4. **Test environment access** if available
5. **Timeline** for when we can expect this information

## Contact Information

**Technical Contact:** [Your technical contact details]  
**Email:** [Your email]  
**Phone:** [Your phone number]  

We appreciate your assistance in resolving these integration issues and look forward to your response.

---

**Attachment:** Complete error logs and request/response examples available upon request.