
INSERT INTO newsletter_signups (email, source, status, discount_amount)
VALUES 
  ('rinogiacomo22@gmail.com', 'lead_recovery', 'active', 0),
  ('robyboy1984@icloud.com', 'lead_recovery', 'active', 0),
  ('atkins95@btinternet.com', 'lead_recovery', 'active', 0),
  ('kovacsroland10@yahoo.com', 'lead_recovery', 'active', 0),
  ('dgfenemore@gmail.com', 'lead_recovery', 'active', 0),
  ('1fairdeal@gmail.com', 'lead_recovery', 'active', 0),
  ('andreimatei69@googlemail.com', 'lead_recovery', 'active', 0),
  ('glenthomas76@hotmail.co.uk', 'lead_recovery', 'active', 0),
  ('islamzaahid9@gmail.com', 'lead_recovery', 'active', 0),
  ('cihan_2524@hotmail.com', 'lead_recovery', 'active', 0)
ON CONFLICT DO NOTHING;
