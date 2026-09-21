// Typical UK garage repair-cost ranges used to answer "how much would this cost
// to fix?" questions instantly, so those chats never wait for a live reply.
// These are indicative independent-garage ranges (parts + labour, inc. VAT) for a
// mainstream car; prestige, performance and EV work sits at the top of each range
// or above it. They are NOT quotes and NOT a statement that a claim will be paid.

export type RepairCostEntry = {
  component: string;
  keywords: string[];
  low: number;
  high: number;
  note?: string;
};

export const REPAIR_COSTS: RepairCostEntry[] = [
  { component: "Engine replacement or rebuild", keywords: ["engine", "rebuild", "piston", "crank", "big end", "head gasket", "cylinder head"], low: 1500, high: 6000, note: "Head gasket work alone usually sits at the lower end." },
  { component: "Gearbox or transmission (automatic)", keywords: ["gearbox", "transmission", "automatic", "dsg", "auto box", "torque converter"], low: 1200, high: 5000 },
  { component: "Clutch and flywheel", keywords: ["clutch", "flywheel", "dual mass"], low: 500, high: 1800 },
  { component: "Turbocharger", keywords: ["turbo", "turbocharger", "supercharger"], low: 800, high: 2500 },
  { component: "Diesel particulate filter (DPF)", keywords: ["dpf", "particulate"], low: 600, high: 2500 },
  { component: "EGR valve", keywords: ["egr"], low: 300, high: 900 },
  { component: "Injectors and fuel pump", keywords: ["injector", "fuel pump", "high pressure pump"], low: 400, high: 2000 },
  { component: "Timing belt or chain", keywords: ["timing belt", "cambelt", "timing chain", "cam chain"], low: 400, high: 1500 },
  { component: "Starter motor or alternator", keywords: ["starter", "alternator"], low: 250, high: 900 },
  { component: "Air conditioning compressor", keywords: ["air con", "aircon", "a/c", "air conditioning", "compressor"], low: 400, high: 1400 },
  { component: "Radiator, water pump and cooling", keywords: ["radiator", "water pump", "cooling", "thermostat", "overheat"], low: 250, high: 1200 },
  { component: "Suspension (shocks, springs, arms)", keywords: ["suspension", "shock", "spring", "wishbone", "control arm", "air suspension"], low: 250, high: 1800, note: "Air suspension units are at the very top of this range." },
  { component: "Steering rack or electric power steering", keywords: ["steering", "rack", "power steering", "eps"], low: 500, high: 2000 },
  { component: "Braking system (ABS pump, calipers, master cylinder)", keywords: ["abs", "caliper", "master cylinder", "brake"], low: 300, high: 1500, note: "Pads and discs are wear items and are not part of warranty cover." },
  { component: "Electrics and control modules (ECU, body module, sensors)", keywords: ["ecu", "module", "electric", "sensor", "wiring", "bcm", "immobiliser"], low: 300, high: 2000 },
  { component: "Diagnostics", keywords: ["diagnostic", "fault find", "diagnose"], low: 60, high: 180 },
  { component: "Hybrid or EV drive battery", keywords: ["battery", "hybrid battery", "ev battery", "traction battery", "drive battery"], low: 2000, high: 12000, note: "Individual module repair is far cheaper than a full pack." },
  { component: "EV drive motor or inverter", keywords: ["drive motor", "inverter", "electric motor", "reduction gear"], low: 1500, high: 7000 },
  { component: "Diesel or petrol DMF / dual mass work", keywords: ["dmf"], low: 600, high: 1800 },
];

export function findRepairCosts(query: string, max = 3): RepairCostEntry[] {
  const q = (query || "").toLowerCase();
  const scored = REPAIR_COSTS.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    return { entry, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.entry);
}

export function money(n: number) {
  return `£${n.toLocaleString("en-GB")}`;
}
