-- Reassign all leads from Isobel (2acbba10-6e7d-48f8-876c-63f607f06368) to Ash (7083d831-4634-47a4-b3e2-61ac9908bf85)
-- ONLY changing assigned_to and assigned_at, preserving all other fields (status, notes, etc.)
UPDATE sales_leads
SET assigned_to = '7083d831-4634-47a4-b3e2-61ac9908bf85',
    assigned_at = now(),
    updated_at = now()
WHERE assigned_to = '2acbba10-6e7d-48f8-876c-63f607f06368';