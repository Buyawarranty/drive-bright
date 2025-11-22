// High-performance models that are not covered by warranty
// This list contains exact model names that should be blocked

export const HIGH_PERFORMANCE_MODELS = [
  // BMW
  "BMW M135i xDrive",
  "BMW M240i Coupé",
  "BMW M235i xDrive Gran Coupé",
  "BMW M2 Coupé",
  "BMW M2 CS",
  "BMW M340i xDrive Sedan",
  "BMW M340d xDrive Sedan",
  "BMW M340i xDrive Touring",
  "BMW M340d xDrive Touring",
  "BMW M3 Sedan",
  "BMW M3 Competition Sedan",
  "BMW M3 CS",
  "BMW M3 Competition Touring",
  "BMW M440i xDrive Coupé",
  "BMW M440d xDrive Coupé",
  "BMW M440i xDrive Convertible",
  "BMW M440d xDrive Convertible",
  "BMW M440i xDrive Gran Coupé",
  "BMW M4 Coupé",
  "BMW M4 Competition Coupé",
  "BMW M4 CS",
  "BMW M4 Competition Convertible",
  "BMW M4 CS Edition VR46",
  "BMW M550i xDrive Sedan",
  "BMW M5 Sedan",
  "BMW M5 Competition",
  "BMW M5 CS",
  "BMW M5 Touring",
  "BMW M760e xDrive",
  "BMW M760Li xDrive",
  "BMW M850i xDrive Coupé",
  "BMW M850i xDrive Convertible",
  "BMW M850i xDrive Gran Coupé",
  "BMW M8 Coupé",
  "BMW M8 Competition Coupé",
  "BMW M8 Convertible",
  "BMW M8 Competition Convertible",
  "BMW M8 Gran Coupé",
  "BMW M8 Competition Gran Coupé",
  "BMW M850i Edition M Heritage",
  "BMW i4 M60 xDrive",
  "BMW i5 M60 Sedan",
  "BMW i5 M60 Touring",
  "BMW i7 M70",
  "BMW iX M70",
  "BMW X1 M35i",
  "BMW X2 M35i",
  "BMW X3 M40i",
  "BMW X3 M40d",
  "BMW X3 M",
  "BMW X3 M Competition",
  "BMW X4 M40i",
  "BMW X4 M40d",
  "BMW X4 M",
  "BMW X4 M Competition",
  "BMW X5 M60i",
  "BMW X5 M",
  "BMW X5 M Competition",
  "BMW X6 M60i",
  "BMW X6 M",
  "BMW X6 M Competition",
  "BMW X7 M60i",
  "BMW XM",
  "BMW XM Label",
  "BMW XM 50e",
  "BMW XM by Kith",
  "BMW Z4 M40i",

  // Audi
  "Audi RS 3 Sportback",
  "Audi RS 3 Sedan",
  "Audi RS 4 Avant",
  "Audi RS 5 Coupé",
  "Audi RS 5 Sportback",
  "Audi RS 6 Avant",
  "Audi RS 6 Avant Performance",
  "Audi RS 7 Sportback",
  "Audi RS Q3",
  "Audi RS Q3 Sportback",
  "Audi RS Q5",
  "Audi RS Q8",
  "Audi RS e-tron GT",
  "Audi TT RS Coupé",
  "Audi TT RS Roadster",
  "Audi R8 Coupé",
  "Audi R8 Spyder",

  // Mercedes-AMG
  "Mercedes-AMG A 35",
  "Mercedes-AMG A 45 S",
  "Mercedes-AMG CLA 35",
  "Mercedes-AMG CLA 45 S",
  "Mercedes-AMG C 43",
  "Mercedes-AMG C 63 S",
  "Mercedes-AMG E 53",
  "Mercedes-AMG E 63 S",
  "Mercedes-AMG S 63",
  "Mercedes-AMG GT 43 4-Door",
  "Mercedes-AMG GT 53 4-Door",
  "Mercedes-AMG GT 63 4-Door",
  "Mercedes-AMG EQE",
  "Mercedes-AMG C 43 Estate",
  "Mercedes-AMG C 63 S Estate",
  "Mercedes-AMG E 53 Estate",
  "Mercedes-AMG E 63 S Estate",
  "Mercedes-AMG CLE 53",
  "Mercedes-AMG CLE 63",
  "Mercedes-AMG C 43 Coupé",
  "Mercedes-AMG C 63 S Coupé",
  "Mercedes-AMG E 53 Coupé",
  "Mercedes-AMG GT Coupé",
  "Mercedes-AMG SL 43",
  "Mercedes-AMG SL 55",
  "Mercedes-AMG SL 63",
  "Mercedes-AMG One",
  "Mercedes-AMG GLA 35",
  "Mercedes-AMG GLA 45",
  "Mercedes-AMG GLB 35",
  "Mercedes-AMG GLC 43",
  "Mercedes-AMG GLC 63",
  "Mercedes-AMG GLC 43 Coupé",
  "Mercedes-AMG GLC 63 Coupé",
  "Mercedes-AMG GLE 53",
  "Mercedes-AMG GLE 63",
  "Mercedes-AMG GLE 53 Coupé",
  "Mercedes-AMG GLE 63 Coupé",
  "Mercedes-AMG GLS 63",
  "Mercedes-AMG G 63",
  "Mercedes-AMG EQE SUV",
  "Mercedes-AMG EQS SUV",

  // Ford
  "Ford Fiesta ST",
  "Ford Focus ST",
  "Ford Focus RS",
  "Ford Puma ST",
  "Ford Mustang GT",
  "Ford Mustang Mach 1",
  "Ford Mustang Mach-E GT",
  "Ford GT",
  "Ford Ranger Raptor",

  // Vauxhall
  "Vauxhall Corsa VXR",
  "Vauxhall Astra VXR",
  "Vauxhall Astra GTC VXR",
  "Vauxhall Insignia VXR",
  "Vauxhall Vectra VXR",
  "Vauxhall Zafira VXR",
  "Vauxhall Meriva VXR",
  "Vauxhall VX220 VXR",
  "Vauxhall Monaro VXR",
  "Vauxhall VXR8",
  "Vauxhall GSi",

  // MINI
  "MINI JCW 3-Door Hatch",
  "MINI JCW Convertible",
  "MINI JCW Clubman",
  "MINI JCW Countryman",
  "MINI JCW Electric",

  // Land Rover
  "Range Rover Sport SVR",
  "Range Rover Sport SV",
  "Range Rover SVAutobiography Dynamic",
  "Defender V8",
  "Defender V8 Carpathian Edition",
  "Range Rover Velar SVAutobiography Dynamic Edition",
  "Range Rover SV Black",
  "Range Rover SV Carbon"
];

/**
 * Check if a vehicle model is a high-performance model that cannot be covered
 * @param make - Vehicle make/brand
 * @param model - Vehicle model
 * @returns boolean indicating if the vehicle is blocked
 */
export const isHighPerformanceModel = (make: string, model: string): boolean => {
  if (!make || !model) return false;
  
  // Normalize the make and model for comparison
  const normalizedMake = make.trim().toUpperCase();
  const normalizedModel = model.trim().toUpperCase();
  
  // Construct the full model name as it appears in our list
  const fullModelName = `${normalizedMake} ${normalizedModel}`;
  
  // Check if the full model name matches any in our high-performance list
  return HIGH_PERFORMANCE_MODELS.some(blockedModel => 
    blockedModel.toUpperCase() === fullModelName
  );
};

/**
 * Get the standard message for high-performance vehicles that cannot be covered
 */
export const getHighPerformanceBlockMessage = (): string => {
  return "Thanks for your interest! Unfortunately, we're not able to offer warranty cover for this vehicle. This is down to factors like specialist parts or limited access to suitable repair centres.";
};