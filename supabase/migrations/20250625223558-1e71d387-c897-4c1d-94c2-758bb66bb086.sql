
-- First, let's clear any existing customer data and insert fresh data with proper emails
DELETE FROM public.customers;

-- Insert fake customer data with proper email addresses
INSERT INTO public.customers (name, email, plan_type, registration_plate, voluntary_excess, status) VALUES
('John Smith', 'john.smith@example.com', 'Basic', 'AB12 CDE', 250, 'Active'),
('Sarah Johnson', 'sarah.johnson@example.com', 'Gold', 'FG34 HIJ', 500, 'Active'),
('Mike Williams', 'mike.williams@example.com', 'Platinum', 'KL56 MNO', 750, 'Active'),
('Emma Brown', 'emma.brown@example.com', 'Basic', 'PQ78 RST', 250, 'Active'),
('David Wilson', 'david.wilson@example.com', 'Gold', 'UV90 WXY', 500, 'Cancelled'),
('Lisa Davis', 'lisa.davis@example.com', 'Platinum', 'ZA12 BCD', 1000, 'Active'),
('Tom Anderson', 'tom.anderson@example.com', 'Basic', 'EF34 GHI', 250, 'Active'),
('Jane Miller', 'jane.miller@example.com', 'Gold', 'JK56 LMN', 500, 'Active'),
('Robert Taylor', 'robert.taylor@example.com', 'Platinum', 'OP78 QRS', 750, 'Active'),
('Amy Clark', 'amy.clark@example.com', 'Basic', 'TU90 VWX', 250, 'Active');
