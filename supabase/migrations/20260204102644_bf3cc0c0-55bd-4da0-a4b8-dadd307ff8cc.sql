-- Clean up duplicate notes - keep only the first occurrence of each
-- This is a one-time cleanup for the duplicate entries caused by the autosave bug

WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lead_id, note_text 
           ORDER BY created_at ASC
         ) as rn
  FROM lead_quick_notes
)
DELETE FROM lead_quick_notes
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
)