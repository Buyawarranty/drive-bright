-- Reassign Isobel's customer records (Mar 2 2026 - today) to info@buyawarranty.co.uk
-- Only changes assigned_to. Does NOT touch status, notes, or any other fields.
-- Does NOT affect James's leads (filtered by Isobel's ID only).
UPDATE customers
SET assigned_to = '0975f77e-a487-445d-8bf1-43955eb2de40'
WHERE assigned_to = '2acbba10-6e7d-48f8-876c-63f607f06368'
  AND is_deleted = false
  AND updated_at >= '2026-03-02T00:00:00Z';