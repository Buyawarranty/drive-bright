
-- Update Basic plan pricing to match the spreadsheet
UPDATE public.plans 
SET monthly_price = 31.00, 
    yearly_price = 381.00, 
    two_yearly_price = 725.00, 
    three_yearly_price = 1050.00 
WHERE name = 'Basic';

-- Update Gold plan pricing to match the spreadsheet  
UPDATE public.plans 
SET monthly_price = 34.00, 
    yearly_price = 409.00, 
    two_yearly_price = 777.00, 
    three_yearly_price = 1125.00 
WHERE name = 'Gold';

-- Update Platinum plan pricing to match the spreadsheet
UPDATE public.plans 
SET monthly_price = 36.00, 
    yearly_price = 437.00, 
    two_yearly_price = 831.00, 
    three_yearly_price = 1200.00 
WHERE name = 'Platinum';
