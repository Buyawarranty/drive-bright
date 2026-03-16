-- Reassign Isobel's customer records (Feb 17 - Mar 2, 2026) to Ash
-- Only changes assigned_to. Does NOT touch status, notes, or any other fields.
-- Does NOT affect James's leads at all (filtered by Isobel's admin_user_id only).
UPDATE customers
SET assigned_to = '7083d831-4634-47a4-b3e2-61ac9908bf85'
WHERE assigned_to = '2acbba10-6e7d-48f8-876c-63f607f06368'
  AND is_deleted = false
  AND updated_at >= '2026-02-17T00:00:00Z'
  AND updated_at < '2026-03-03T00:00:00Z';