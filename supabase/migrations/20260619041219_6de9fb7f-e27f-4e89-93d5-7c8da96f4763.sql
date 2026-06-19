
UPDATE public.abandoned_cart_email_templates
SET is_active = false
WHERE trigger_type IN ('pricing_page_view','plan_selected','checkout_abandoned','pricing_page_view_24h','pricing_page_view_72h');

DELETE FROM public.abandoned_cart_email_templates
WHERE trigger_type IN ('reminder_1h','reminder_2d','reminder_7d','reminder_14d','reminder_18d','reminder_21d');

INSERT INTO public.abandoned_cart_email_templates (trigger_type, name, subject, html_content, text_content, send_delay_minutes, is_active) VALUES
  ('reminder_1h',  'Reminder 1 – Quote saved (1 hour)',          'Your warranty quote is saved – pick up where you left off',                      '<generated>', '<generated>', 60,    true),
  ('reminder_2d',  'Reminder 2 – Still thinking (Day 2)',         'Still thinking it over? Here''s £25 off with code SAVE25GO',                    '<generated>', '<generated>', 2880,  true),
  ('reminder_7d',  'Reminder 3 – Don''t lose your quote (Day 7)', 'Don''t lose your saved quote – £25 off inside',                                 '<generated>', '<generated>', 10080, true),
  ('reminder_14d', 'Reminder 4 – Prices may change (Day 14)',     'Prices may change – lock in your warranty quote with £25 off',                  '<generated>', '<generated>', 20160, true),
  ('reminder_18d', 'Reminder 5 – Almost gone (Day 18)',           'Almost gone – your £25 discount is about to expire',                            '<generated>', '<generated>', 25920, true),
  ('reminder_21d', 'Reminder 6 – Last chance (Day 21)',           'Last chance – your £25 off and saved quote expire tonight',                     '<generated>', '<generated>', 30240, true);
