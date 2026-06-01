## Changes to `src/components/admin/PolicyDocumentsTab.tsx` (edit mode only)

### 1. Customer Details — add Surname field
Replace the single "Full Name" input in edit mode with two inputs side-by-side:
- **First Name** → bound to `editData.first_name`
- **Surname** → bound to `editData.last_name`

When entering edit mode, pre-populate from `selectedCustomer.first_name` / `last_name`, falling back to splitting `selectedCustomer.name` (first word = first name, remainder = surname) when those columns are empty.

On Save:
- Write `first_name` and `last_name` from the two inputs.
- Write `name` = `${first_name} ${last_name}`.trim() so the existing display, letters, and labels keep working.

Read-only view (`Name: …`) is unchanged.

### 2. Vehicle & Cover — auto-fill from DVLA
Add a small **"Lookup DVLA"** button next to the Registration input in edit mode (only visible in edit mode). Behavior:
- Calls existing edge function `dvla-vehicle-lookup` with the current `editData.registration_plate`.
- On success, populates `editData.vehicle_make`, `vehicle_model`, `vehicle_year` (only fills blanks unless user confirms overwrite — simple approach: always overwrite and toast "Vehicle details updated from DVLA").
- Also auto-trigger lookup once when entering edit mode IF Make/Model/Year are all empty and a registration is present (so existing records like the screenshot get filled automatically). A small spinner shows during fetch.
- Errors → toast with the DVLA error message; no field changes.

Note: DVLA Vehicle Enquiry returns make + year (yearOfManufacture). Model is not provided by the free DVLA API. We'll use MOT history (`fetch-mot-history`) as a secondary call to get `model` when missing — both functions already exist in the project.

### 3. Save logic
Extend the existing Save handler to include the split names as above. No DB schema changes needed — `first_name` and `last_name` columns already exist on `customers`.

### Out of scope
- No changes to display mode, letters, labels, or other tabs.
- No DB migration.
- No changes to non-edit flows.
