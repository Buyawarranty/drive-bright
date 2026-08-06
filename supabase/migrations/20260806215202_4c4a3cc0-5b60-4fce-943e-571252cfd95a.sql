UPDATE public.pricing_matrix_versions
SET vehicle_factor_model = '{
  "refBandKey": "6-7",
  "bands": [
    {"key":"1-3","oneYear":399},
    {"key":"4-5","oneYear":449},
    {"key":"6-7","oneYear":499},
    {"key":"8-9","oneYear":549},
    {"key":"10-11","oneYear":649},
    {"key":"12","oneYear":699},
    {"key":"13","oneYear":799},
    {"key":"14","oneYear":849},
    {"key":"15","oneYear":899},
    {"key":"15+","oneYear":null}
  ],
  "mileageBands": [
    {"min":0,"max":40000,"factor":1.0},
    {"min":40001,"max":60000,"factor":1.0},
    {"min":60001,"max":80000,"factor":1.05},
    {"min":80001,"max":100000,"factor":1.1},
    {"min":100001,"max":120000,"factor":1.15},
    {"min":120001,"max":150000,"factor":1.25},
    {"min":150001,"max":null,"factor":null}
  ],
  "powertrains": [
    {"key":"petrol","factor":1.0},
    {"key":"diesel","factor":1.05},
    {"key":"hev","factor":1.0},
    {"key":"phev","factor":1.08},
    {"key":"ev","factor":1.08}
  ],
  "vehicleTypes": [
    {"key":"car","factor":1.0},
    {"key":"van","factor":1.12},
    {"key":"motorbike","factor":0.5}
  ]
}'::jsonb
WHERE status = 'live' AND vehicle_factor_model IS NULL;