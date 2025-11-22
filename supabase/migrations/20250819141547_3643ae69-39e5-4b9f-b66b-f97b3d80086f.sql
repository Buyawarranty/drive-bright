-- Update Basic plan to remove "Recovery" from coverage
UPDATE plans 
SET coverage = '[
  "Engine",
  "Manual Gearbox", 
  "Automatic Transmission",
  "Torque Converter",
  "Overdrive",
  "Differential", 
  "Electrics",
  "Casings",
  "Labour up to £35 p/hr",
  "Max 10 claims per year"
]'::jsonb,
updated_at = now()
WHERE name = 'Basic';

-- Update Gold plan to change "Recovery" to "Recover Claim-back"
UPDATE plans 
SET coverage = '[
  "Engine",
  "Manual Gearbox", 
  "Automatic Transmission",
  "Torque Converter",
  "Overdrive",
  "Differential", 
  "Electrics",
  "Casings",
  "Recover Claim-back",
  "Basic plan plus:",
  "Labour up to £75 p/hr",
  "*FREE Halfords MOT test",
  "*Unlimited Claims",
  "Clutch",
  "Cooling System",
  "Fuel System",
  "Braking System",
  "Propshaft",
  "Vehicle Hire",
  "European Cover"
]'::jsonb,
updated_at = now()
WHERE name = 'Gold';

-- Update Platinum plan to change "Recovery" to "Recover Claim-back"
UPDATE plans 
SET coverage = '[
  "Engine",
  "Manual Gearbox", 
  "Automatic Transmission",
  "Torque Converter",
  "Overdrive",
  "Differential", 
  "Electrics",
  "Casings",
  "Recover Claim-back",
  "Clutch",
  "Cooling System",
  "Fuel System",
  "Braking System",
  "Propshaft",
  "Vehicle Hire",
  "European Cover",
  "Gold plan plus:",
  "Labour up to £100 p/hr",
  "*Free Halfords MOT test",
  "*Unlimited Claims",
  "Turbo",
  "Airconditioning",
  "ECU",
  "Drive Shafts",
  "Steering",
  "Suspension",
  "Bearings",
  "Ventilation",
  "Locks",
  "Seals"
]'::jsonb,
updated_at = now()
WHERE name = 'Platinum';