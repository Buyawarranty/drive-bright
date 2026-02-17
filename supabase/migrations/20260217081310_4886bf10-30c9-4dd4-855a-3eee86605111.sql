
-- Remove non-sales users from distribution caps
DELETE FROM agent_distribution_caps 
WHERE admin_user_id IN (
  'e39499b8-f88c-4963-9f0d-63e1addb3025',  -- support@buyawarranty.co.uk (admin)
  '0975f77e-a487-445d-8bf1-43955eb2de40',  -- info@buyawarranty.co.uk (admin)
  '8f4974a6-e035-41d8-9ec7-e66fccf0167c',  -- prajwalchauhan2001@gmail.com
  '680d0ffc-047e-4de2-8bdb-eeba96e33400'   -- prajwalchauhan26@gmail.com
);

-- Add Isobel Ivinson (sales)
INSERT INTO agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
VALUES ('2acbba10-6e7d-48f8-876c-63f607f06368', 20, 0, false)
ON CONFLICT (admin_user_id) DO NOTHING;

-- Add Jas J (sales)
INSERT INTO agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
VALUES ('6c41e993-65ea-4b3a-8146-5b09c65263bc', 20, 0, false)
ON CONFLICT (admin_user_id) DO NOTHING;
