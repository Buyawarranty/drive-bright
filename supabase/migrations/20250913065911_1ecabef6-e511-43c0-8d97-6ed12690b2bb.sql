-- Normalize special_vehicle_plans.vehicle_type to lowercase to match app queries
UPDATE public.special_vehicle_plans
SET vehicle_type = lower(vehicle_type), updated_at = now();