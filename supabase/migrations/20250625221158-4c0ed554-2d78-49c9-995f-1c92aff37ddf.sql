
-- Add registration_plate column to customers table
ALTER TABLE public.customers 
ADD COLUMN registration_plate TEXT;

-- Add yearly pricing columns to plans table
ALTER TABLE public.plans 
ADD COLUMN yearly_price NUMERIC,
ADD COLUMN two_yearly_price NUMERIC,
ADD COLUMN three_yearly_price NUMERIC;

-- Update existing plans with correct pricing
UPDATE public.plans 
SET monthly_price = 9.99, 
    yearly_price = 107.88, 
    two_yearly_price = 203.76, 
    three_yearly_price = 287.73 
WHERE name = 'Basic';

UPDATE public.plans 
SET monthly_price = 19.99, 
    yearly_price = 215.88, 
    two_yearly_price = 407.76, 
    three_yearly_price = 575.73 
WHERE name = 'Gold';

UPDATE public.plans 
SET monthly_price = 29.99, 
    yearly_price = 323.88, 
    two_yearly_price = 611.76, 
    three_yearly_price = 863.73 
WHERE name = 'Platinum';

-- Insert some fake customer data for testing (fixed status values)
INSERT INTO public.customers (name, email, plan_type, registration_plate, voluntary_excess, status) VALUES
('John Smith', 'john.smith@email.com', 'Basic', 'PL67KUB', 250, 'Active'),
('Sarah Johnson', 'sarah.johnson@email.com', 'Gold', 'DG62LBY', 500, 'Active'),
('Mike Williams', 'mike.williams@email.com', 'Platinum', 'YA14NCY', 750, 'Active'),
('Emma Brown', 'emma.brown@email.com', 'Basic', 'H12FXL', 250, 'Active'),
('David Wilson', 'david.wilson@email.com', 'Gold', 'BX18TRF', 500, 'Cancelled'),
('Lisa Davis', 'lisa.davis@email.com', 'Platinum', 'MN21QWE', 1000, 'Active'),
('Tom Anderson', 'tom.anderson@email.com', 'Basic', 'RT19ZXC', 250, 'Active'),
('Jane Miller', 'jane.miller@email.com', 'Gold', 'KL20VBN', 500, 'Active');
