-- Update document mappings with correct storage paths
UPDATE plan_document_mapping 
SET document_path = 'basic/Basic-Cover-Warranty-Plan-Buyawarranty%202.0-1754464740490.pdf'
WHERE plan_name = 'Basic' AND vehicle_type = 'standard';

UPDATE plan_document_mapping 
SET document_path = 'gold/Gold-Extended-Warranty-Plan-Buy-a-Warranty%202.0-1754464758473.pdf'
WHERE plan_name = 'Gold' AND vehicle_type = 'standard';

UPDATE plan_document_mapping 
SET document_path = 'platinum/Platinum-Extended-Warranty%202.0-1754464769023.pdf'
WHERE plan_name = 'Platinum' AND vehicle_type = 'standard';

-- Add missing mappings for other plan types
INSERT INTO plan_document_mapping (plan_name, vehicle_type, document_path) 
VALUES 
  ('Electric vehicle ev extended warranty', 'standard', 'electric/EV-Extended-Warranty-Plan-Buy-a-Warranty%202.0-1754464859338.pdf'),
  ('Motorbike Extended Warranty', 'standard', 'motorbike/Motorbike-Extended-Warranty-Plan%202.0-1754464869722.pdf'),
  ('PHEV Hybrid Extended Warranty', 'standard', 'phev/Hybrid-PHEV-Warranty-Plan%202.0-1754464878940.pdf')
ON CONFLICT (plan_name, vehicle_type) DO UPDATE SET 
  document_path = EXCLUDED.document_path,
  updated_at = now();