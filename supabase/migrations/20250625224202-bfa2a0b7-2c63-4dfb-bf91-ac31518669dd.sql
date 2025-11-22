
-- First, let's see what plan types are allowed by checking existing plans
SELECT name FROM public.plans WHERE is_active = true;

-- Insert sample customer data using the correct plan types from the plans table
INSERT INTO public.customers (name, email, plan_type, registration_plate, voluntary_excess, status) VALUES
('John Smith', 'john.smith@email.com', 'Basic', 'AB12 CDE', 500, 'Active'),
('Sarah Johnson', 'sarah.johnson@email.com', 'Gold', 'FG34 HIJ', 250, 'Active'),
('Michael Brown', 'michael.brown@email.com', 'Platinum', 'KL56 MNO', 100, 'Active'),
('Emma Davis', 'emma.davis@email.com', 'Basic', 'PQ78 RST', 750, 'Active'),
('David Wilson', 'david.wilson@email.com', 'Gold', 'UV90 WXY', 300, 'Cancelled');
