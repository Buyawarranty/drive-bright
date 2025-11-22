-- Update FH11 SSK customer record to have correct voluntary excess
UPDATE customers 
SET voluntary_excess = 50 
WHERE registration_plate = 'FH11 SSK' AND email = 'buyawarranty1@gmail.com';