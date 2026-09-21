/**
 * Crawler-visible body content for prerendered routes.
 *
 * The SPA replaces #root on hydration, so this markup is only ever seen by
 * search crawlers, AI answer engines (GPTBot, ClaudeBot, PerplexityBot,
 * Google-Extended) and text-only fetches. It exists to give every warranty
 * page a valid heading outline (single H1 -> H2 sections -> H3 sub-points),
 * unique UK-specific wording, and answer-shaped FAQ text.
 *
 * Copy rules:
 * - Written for a UK audience only (MOT, DVLA, VAT-registered garages, £).
 * - Unique per page: no shared paragraph is reused verbatim across routes.
 * - Factual and conservative: no invented claim figures or repair prices.
 */

export interface FaqEntry {
  q: string;
  a: string;
}

export interface BodySection {
  h2: string;
  paras: string[];
  /** Rendered as H3 + paragraph pairs so the outline never skips a level. */
  points?: { h3: string; text: string }[];
}

export interface PageBody {
  h1: string;
  intro: string;
  sections: BodySection[];
  faqs: FaqEntry[];
}

/** Per-vehicle facts used to build unique section copy. */
interface VehicleFacts {
  /** Display label, e.g. "Audi", "electric vehicle", "van". */
  label: string;
  /** Grammatical owner phrase, e.g. "Audi drivers", "van operators". */
  owners: string;
  /** Popular UK models / variants. */
  models: string[];
  /** Components UK owners most often ask us about. */
  components: string[];
  /** One UK-market observation unique to this vehicle type. */
  ukContext: string;
  /** What we look at when pricing this vehicle. */
  pricingNote: string;
}

const FACTS: Record<string, VehicleFacts> = {
  audi: {
    label: 'Audi',
    owners: 'Audi owners',
    models: ['A1', 'A3 Sportback', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'TT', 'e-tron'],
    components: [
      'S tronic dual-clutch gearbox and mechatronic unit',
      'TFSI and TDI turbochargers',
      'quattro transfer case and haldex coupling',
      'MMI infotainment head unit',
      'air suspension struts and compressor',
    ],
    ukContext:
      'Most UK Audis leave the three-year manufacturer warranty with well under 60,000 miles on the clock, which is usually before the gearbox, turbo and infotainment repairs start appearing on independent specialist invoices.',
    pricingNote:
      'Your price is based on the registration, current mileage, the claim limit you pick, the hourly labour rate your garage charges and the voluntary excess you choose.',
  },
  bmw: {
    label: 'BMW',
    owners: 'BMW drivers',
    models: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', 'X1', 'X3', 'X5', 'i3', 'i4'],
    components: [
      'timing chain and VANOS units',
      'ZF automatic gearbox and mechatronic sleeve',
      'high-pressure fuel pump on N20 and B48 engines',
      'iDrive control unit and screen',
      'xDrive transfer box',
    ],
    ukContext:
      'BMW main-dealer labour rates in London and the South East are typically well above the independent-specialist rate, so the labour rate you choose on your plan matters as much as the claim limit.',
    pricingNote:
      'Pick the hourly labour rate that matches where you actually service the car — a BMW specialist and a franchised dealer charge very differently.',
  },
  mercedes: {
    label: 'Mercedes-Benz',
    owners: 'Mercedes-Benz owners',
    models: ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'CLA', 'V-Class', 'EQC'],
    components: [
      '7G-Tronic and 9G-Tronic gearboxes',
      'AIRMATIC suspension',
      'AdBlue injection and emissions modules',
      'COMAND / MBUX head unit',
      'balance shaft and timing components on older M272 engines',
    ],
    ukContext:
      'Air suspension and MBUX electronics are the two areas UK Mercedes owners contact us about most once a car passes six years old and its second or third MOT after warranty expiry.',
    pricingNote:
      'Cover is priced from your reg and mileage, then adjusted by claim limit, labour rate and excess — nothing is added afterwards at checkout.',
  },
  citroen: {
    label: 'Citroën',
    owners: 'Citroën owners',
    models: ['C1', 'C3', 'C3 Aircross', 'C4', 'C5 Aircross', 'Berlingo', 'DS3', 'ë-C4'],
    components: [
      'PureTech wet timing belt assembly',
      'EAT6 / EAT8 automatic gearbox',
      'BlueHDi DPF and AdBlue system',
      'suspension spheres on hydraulic models',
      'body control module and central electrics',
    ],
    ukContext:
      'The PureTech wet belt has become the single most searched Citroën repair topic in the UK, and it is exactly the kind of consequential engine damage a mechanical breakdown plan is designed for.',
    pricingNote:
      'Small-capacity Citroëns usually sit at the lower end of our price range, so a higher claim limit often costs only a few pounds a month more.',
  },
  ev: {
    label: 'electric vehicle',
    owners: 'EV drivers',
    models: ['Nissan Leaf', 'Tesla Model 3', 'Renault Zoe', 'Kia e-Niro', 'MG4', 'VW ID.3', 'Polestar 2'],
    components: [
      'drive motor and reduction gearbox',
      'on-board charger and charge port',
      'inverter and DC-DC converter',
      'battery cooling pump and thermal management',
      'high-voltage cabling and contactors',
    ],
    ukContext:
      'UK manufacturers usually warrant the traction battery separately for around eight years, but the motor, charger and power electronics drop back to the standard three-year term — that gap is where most EV bills land.',
    pricingNote:
      'EV plans are priced on the same reg-and-mileage basis as petrol cars; there is no separate EV surcharge bolted on at the end.',
  },
  honda: {
    label: 'Honda',
    owners: 'Honda owners',
    models: ['Jazz', 'Civic', 'CR-V', 'HR-V', 'Accord', 'e:Ny1'],
    components: [
      'CVT transmission and torque converter',
      'i-DTEC turbocharger and EGR',
      'IMA / e:HEV hybrid drive components',
      'air conditioning compressor',
      'electric power steering rack',
    ],
    ukContext:
      'Hondas are among the longer-lived cars on UK roads, so we see plenty of plans taken out on cars between 90,000 and 130,000 miles where CVT and hybrid drive repairs are the main worry.',
    pricingNote:
      'Higher-mileage Hondas remain quotable online — enter the true mileage and the price adjusts rather than being declined at checkout.',
  },
  hybrid: {
    label: 'hybrid',
    owners: 'hybrid owners',
    models: ['Toyota Prius', 'Toyota Yaris Hybrid', 'Honda Jazz e:HEV', 'Lexus CT', 'Kia Niro HEV'],
    components: [
      'hybrid transaxle and motor-generators',
      'inverter and converter assembly',
      'hybrid battery cooling fan and ducting',
      'regenerative braking actuator',
      'engine start-stop and DC-DC systems',
    ],
    ukContext:
      'Ex-private-hire Priuses and Aurises now make up a large share of the UK used hybrid market, and their high mileages make inverter and brake actuator faults far more common than on a comparable petrol car.',
    pricingNote:
      'Hybrid plans cover the petrol engine and the hybrid drive together, so you are not left choosing between the two halves of the car.',
  },
  jeep: {
    label: 'Jeep',
    owners: 'Jeep owners',
    models: ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Avenger'],
    components: [
      'nine-speed automatic gearbox',
      'MultiJet turbocharger and EGR cooler',
      'four-wheel-drive transfer case and couplings',
      'Uconnect infotainment module',
      'electronic throttle body and sensors',
    ],
    ukContext:
      'Jeep parts in the UK often come through a smaller specialist network than mainstream brands, so a plan with a realistic labour rate and a claim limit that reflects UK parts pricing matters more than usual.',
    pricingNote:
      'Four-wheel-drive models sit slightly higher in our pricing than a front-wheel-drive hatchback of the same age and mileage.',
  },
  kia: {
    label: 'Kia',
    owners: 'Kia owners',
    models: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Niro', 'Sorento', 'e-Niro', 'EV6'],
    components: [
      'DCT dual-clutch gearbox',
      'GDi high-pressure fuel pump and injectors',
      'turbocharger on 1.0 and 1.6 T-GDi engines',
      'air conditioning compressor',
      'EV drive motor and on-board charger',
    ],
    ukContext:
      'Kia’s seven-year UK warranty means most cars come to us at the point that cover lapses — often around 90,000 to 100,000 miles, where DCT and fuel-system repairs become the realistic risk.',
    pricingNote:
      'If your Kia has just come off its seven-year cover, cover can start the day the manufacturer term ends so there is no unprotected gap.',
  },
  motorbike: {
    label: 'motorbike',
    owners: 'riders',
    models: ['Honda CB', 'Yamaha MT', 'Kawasaki Z', 'Suzuki GSX', 'Triumph Bonneville', 'BMW GS'],
    components: [
      'gearbox and selector mechanism',
      'clutch basket and primary drive',
      'fuel injection and throttle bodies',
      'regulator/rectifier and stator',
      'ABS modulator and wheel sensors',
    ],
    ukContext:
      'Most UK bikes cover low annual mileage but sit through wet winters, so electrical faults — regulators, stators and ABS sensors — cause more claims than worn engine internals.',
    pricingNote:
      'Motorbike plans are priced at half the equivalent car rate, including the minimum price, so a bike plan is always the cheapest cover we arrange.',
  },
  nissan: {
    label: 'Nissan',
    owners: 'Nissan owners',
    models: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Note', 'Ariya'],
    components: [
      'Xtronic CVT transmission',
      'DIG-T turbocharger and timing chain',
      '1.5 dCi injectors and DPF',
      'Leaf on-board charger and PDM',
      'ABS actuator and body control module',
    ],
    ukContext:
      'The Qashqai is one of the most common cars on UK roads, and the Xtronic CVT is the repair owners ask about most — a single transmission bill can exceed the cost of several years of cover.',
    pricingNote:
      'CVT-equipped Nissans are quotable online in the normal way; pick a claim limit that reflects a transmission-sized bill rather than the cheapest option.',
  },
  phev: {
    label: 'plug-in hybrid',
    owners: 'plug-in hybrid drivers',
    models: ['Mitsubishi Outlander PHEV', 'BMW 330e', 'Volvo XC60 T8', 'Kia Niro PHEV', 'Mercedes A250e'],
    components: [
      'on-board charger and charge flap actuator',
      'electric drive motor and generator',
      'battery cooling circuit',
      'petrol engine and turbocharger',
      'DC-DC converter and high-voltage relays',
    ],
    ukContext:
      'Plug-in hybrids bought as company cars for the UK benefit-in-kind saving often reach the used market at three or four years old with the traction battery still warranted but everything around it out of cover.',
    pricingNote:
      'PHEV cover includes both drivetrains, so you are protected whether the fault is on the petrol side or the high-voltage side.',
  },
  smart: {
    label: 'smart',
    owners: 'smart owners',
    models: ['fortwo', 'forfour', 'EQ fortwo', 'roadster', '#1'],
    components: [
      'automated manual clutch actuator',
      'gear selector motor and sensors',
      'rear-mounted engine ancillaries',
      'EQ on-board charger and battery cooling',
      'power steering and ABS electronics',
    ],
    ukContext:
      'City-driven smarts rack up short trips and constant gear changes rather than motorway miles, which is why clutch actuator and selector faults dominate the repairs UK owners ask us about.',
    pricingNote:
      'Small city cars sit at the bottom of our price range, so the top claim limit usually costs very little extra each month.',
  },
  subaru: {
    label: 'Subaru',
    owners: 'Subaru owners',
    models: ['Impreza', 'Forester', 'Outback', 'XV', 'Levorg', 'BRZ'],
    components: [
      'boxer engine head gaskets and timing components',
      'Lineartronic CVT',
      'symmetrical all-wheel-drive differentials',
      'turbocharger on WRX and Levorg engines',
      'EyeSight camera and control module',
    ],
    ukContext:
      'Subaru’s UK dealer network is small, so owners typically use marque specialists — worth remembering when you set the hourly labour rate on your plan.',
    pricingNote:
      'All-wheel-drive and boxer engines price slightly above an equivalent two-wheel-drive car of the same age and mileage.',
  },
  suv: {
    label: 'SUV',
    owners: 'SUV owners',
    models: ['Nissan Qashqai', 'Kia Sportage', 'Ford Kuga', 'VW Tiguan', 'Hyundai Tucson', 'Range Rover Evoque'],
    components: [
      'four-wheel-drive couplings and transfer cases',
      'automatic and dual-clutch gearboxes',
      'air suspension and self-levelling systems',
      'DPF, EGR and AdBlue components',
      'electric tailgate and driver-assist modules',
    ],
    ukContext:
      'SUVs are now the best-selling body style in the UK, and their extra weight, larger brakes and more complex driveline make out-of-warranty repairs measurably dearer than the hatchbacks they replaced.',
    pricingNote:
      'Heavier vehicles and four-wheel-drive systems raise the price a little, which is why an SUV quote sits above a supermini on identical mileage.',
  },
  tesla: {
    label: 'Tesla',
    owners: 'Tesla owners',
    models: ['Model 3', 'Model Y', 'Model S', 'Model X'],
    components: [
      'rear and front drive units',
      'on-board charger and charge port actuator',
      'power conversion system and DC-DC converter',
      'MCU touchscreen and media control unit',
      'air suspension compressor on Model S and X',
    ],
    ukContext:
      'Tesla’s UK service centres are concentrated around major cities and repairs are quoted at fixed unit prices, so a single drive unit or MCU replacement can be a four-figure bill with no negotiation.',
    pricingNote:
      'Tesla plans cover the drive unit, charging hardware and control electronics — the components that fall outside the separate eight-year battery and drive unit manufacturer cover once it expires.',
  },
  toyota: {
    label: 'Toyota',
    owners: 'Toyota owners',
    models: ['Aygo', 'Yaris', 'Corolla', 'C-HR', 'RAV4', 'Prius', 'Auris', 'Proace'],
    components: [
      'hybrid transaxle and inverter',
      'D-4D injectors and turbocharger',
      'CVT and Multidrive transmissions',
      'water pump and thermostat housing',
      'Toyota Safety Sense radar and camera modules',
    ],
    ukContext:
      'Toyota Relax can extend cover to ten years in the UK provided every service is done at a Toyota dealer — plenty of owners who service independently lose that route and use an aftermarket plan instead.',
    pricingNote:
      'High-mileage Toyotas remain quotable; enter the real mileage from your latest MOT and the price reflects it accurately.',
  },
  vans: {
    label: 'van',
    owners: 'van operators',
    models: ['Ford Transit', 'Transit Custom', 'Vauxhall Vivaro', 'VW Transporter', 'Mercedes Sprinter', 'Peugeot Partner'],
    components: [
      'DPF, EGR and AdBlue systems',
      'turbocharger and intercooler',
      'clutch, dual-mass flywheel and gearbox',
      'injectors and high-pressure fuel pump',
      'sliding door mechanisms and central electrics',
    ],
    ukContext:
      'A van off the road stops the invoices, so UK trade users tend to choose a higher claim limit and a realistic labour rate rather than the cheapest monthly figure — and low-emission-zone-compliant vans are worth keeping on the road longer.',
    pricingNote:
      'Vans are priced on gross weight, age and mileage; business use is expected and does not invalidate cover.',
  },
  vauxhall: {
    label: 'Vauxhall',
    owners: 'Vauxhall owners',
    models: ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Vivaro'],
    components: [
      'timing belt and chain assemblies on 1.4T and PureTech engines',
      'automatic and EAT8 gearboxes',
      'water pump and thermostat housing',
      'DPF and AdBlue components on 1.5 and 1.6 diesels',
      'body control module and electric power steering',
    ],
    ukContext:
      'The Corsa and Astra have been UK best-sellers for decades, so parts are plentiful and affordable — which means labour, not parts, is usually the bigger half of a Vauxhall repair bill.',
    pricingNote:
      'Because Vauxhall parts are inexpensive, choosing a higher hourly labour rate is often the change that matters most on these plans.',
  },
  volkswagen: {
    label: 'Volkswagen',
    owners: 'Volkswagen owners',
    models: ['Polo', 'Golf', 'Passat', 'T-Roc', 'Tiguan', 'Touran', 'ID.3', 'ID.4'],
    components: [
      'DSG gearbox and mechatronic unit',
      'TSI timing chain tensioner and water pump',
      'TDI injectors, EGR and DPF',
      'Discover Media / Navigation head unit',
      'ID. family on-board charger and drive motor',
    ],
    ukContext:
      'The Golf remains one of the most common cars in the UK fleet, and DSG mechatronic work is the repair owners most often insure against once the car passes five years old.',
    pricingNote:
      'DSG-equipped Volkswagens are quotable in the usual way — set the claim limit high enough to cover a mechatronic unit and labour together.',
  },
  dacia: {
    label: 'Dacia',
    owners: 'Dacia owners',
    models: ['Sandero', 'Sandero Stepway', 'Duster', 'Jogger', 'Spring'],
    components: [
      'TCe turbocharger and timing chain',
      'clutch and manual gearbox',
      'dCi injectors and EGR valve',
      'air conditioning compressor',
      'Media Nav unit and body electrics',
    ],
    ukContext:
      'Dacia buyers in the UK choose the brand for low running costs, so an unexpected turbo or gearbox bill hits harder proportionally than it would on a premium car — cover is priced to stay in keeping with the car.',
    pricingNote:
      'Dacias sit at the affordable end of our range, so the difference between the entry and top claim limit is usually small.',
  },
};

const CTA_LINKS: [string, string][] = [
  ['/', 'Get an instant warranty quote'],
  ['/what-is-covered/', "What's covered"],
  ['/warranty-plan/', 'Warranty plans and pricing'],
  ['/warranty-types/', 'Cover by vehicle and make'],
  ['/faq/', 'Frequently asked questions'],
  ['/make-a-claim/', 'Make a claim'],
  ['/contact-us/', 'Contact our UK team'],
];

export const PRERENDER_LINKS = CTA_LINKS;

function buildBody(facts: VehicleFacts, keyword: string): PageBody {
  const { label, owners, models, components, ukContext, pricingNote } = facts;
  const isType = /vehicle|hybrid|van|SUV|motorbike/i.test(label);
  const subject = isType ? `${label}s` : `${label}s`;

  return {
    h1: keyword,
    intro: `${keyword} from Buy A Warranty covers the mechanical and electrical failures that ${owners} in the UK actually pay for once the manufacturer term runs out. Quote online with your registration and mileage, choose your claim limit, hourly labour rate and voluntary excess, and cover can start straight away.`,
    sections: [
      {
        h2: `What a ${label} warranty covers in the UK`,
        paras: [
          `Cover is built around the parts that fail on ${subject} rather than a generic component list. The areas ${owners} ask us about most are set out below, and each is included subject to the plan level and claim limit you choose.`,
        ],
        points: components.slice(0, 5).map((c) => ({
          h3: c.charAt(0).toUpperCase() + c.slice(1),
          text: `Diagnosis, parts and labour for ${c} are claimable up to your chosen limit when the fault is a sudden mechanical or electrical failure rather than routine servicing or wear replacement.`,
        })),
      },
      {
        h2: `${label} models we cover`,
        paras: [
          `We arrange cover for ${models.slice(0, -1).join(', ')} and ${models[models.length - 1]}, along with most other ${label} variants registered in the UK up to 15 years old and 150,000 miles.`,
          `Petrol, diesel, hybrid and fully electric versions are all quotable, and Northern Ireland registrations are accepted alongside GB plates.`,
        ],
      },
      {
        h2: `Why ${owners} take out cover after the factory term`,
        paras: [ukContext],
      },
      {
        h2: `How ${label} warranty pricing works`,
        paras: [
          pricingNote,
          `Every quote shows the monthly figure and the pay-in-full total before you commit, with no admin fee added at checkout and a 14-day cooling-off period after purchase.`,
        ],
      },
      {
        h2: `Making a ${label} claim`,
        paras: [
          `Take the vehicle to any VAT-registered garage in the UK, including a marque specialist or franchised dealer. Ask them to send us the diagnosis and estimate, we authorise the repair against your claim limit and labour rate, and we settle with the garage directly wherever possible so you are not left funding the bill and waiting for a refund.`,
        ],
      },
    ],
    faqs: [
      {
        q: `Is a ${label} warranty worth it in the UK?`,
        a: `It is worth it when a single realistic repair would cost more than the plan. ${ukContext}`,
      },
      {
        q: `Can I use my own garage for ${label} repairs?`,
        a: `Yes. Any VAT-registered garage in the UK can carry out the work, including ${label} specialists and franchised dealers, as long as the repair is authorised before work starts.`,
      },
      {
        q: `Does a high-mileage ${label} still qualify?`,
        a: `Yes, up to 150,000 miles and 15 years old at the point cover starts. ${pricingNote}`,
      },
      {
        q: `How quickly can ${label} cover start?`,
        a: `Cover can begin immediately after purchase, or on a future date if you are waiting for a manufacturer or dealer warranty to expire first.`,
      },
    ],
  };
}

/** Path (with trailing slash) -> crawler body. */
export const PAGE_BODIES: Record<string, PageBody> = {
  '/warranty-types/audi-warranty/': buildBody(FACTS.audi, 'Audi extended warranty UK'),
  '/warranty-types/bmw-warranty/': buildBody(FACTS.bmw, 'BMW extended warranty UK'),
  '/warranty-types/citroen-warranty/': buildBody(FACTS.citroen, 'Citroën extended warranty UK'),
  '/warranty-types/dacia-warranty/': buildBody(FACTS.dacia, 'Dacia extended warranty UK'),
  '/warranty-types/ev-warranty/': buildBody(FACTS.ev, 'Electric vehicle warranty UK'),
  '/warranty-types/honda-warranty/': buildBody(FACTS.honda, 'Honda extended warranty UK'),
  '/warranty-types/hybrid-warranty/': buildBody(FACTS.hybrid, 'Hybrid car warranty UK'),
  '/warranty-types/jeep-warranty/': buildBody(FACTS.jeep, 'Jeep extended warranty UK'),
  '/warranty-types/kia-warranty/': buildBody(FACTS.kia, 'Kia extended warranty UK'),
  '/warranty-types/mercedes-warranty/': buildBody(FACTS.mercedes, 'Mercedes-Benz extended warranty UK'),
  '/warranty-types/motorbike-motorcycle-warranty/': buildBody(FACTS.motorbike, 'Motorbike warranty UK'),
  '/warranty-types/nissan-warranty/': buildBody(FACTS.nissan, 'Nissan extended warranty UK'),
  '/warranty-types/phev-warranty/': buildBody(FACTS.phev, 'Plug-in hybrid warranty UK'),
  '/warranty-types/smart-warranty/': buildBody(FACTS.smart, 'smart car warranty UK'),
  '/warranty-types/subaru-warranty/': buildBody(FACTS.subaru, 'Subaru extended warranty UK'),
  '/warranty-types/suv-warranty/': buildBody(FACTS.suv, 'SUV extended warranty UK'),
  '/warranty-types/tesla-warranty/': buildBody(FACTS.tesla, 'Tesla extended warranty UK'),
  '/warranty-types/toyota-warranty/': buildBody(FACTS.toyota, 'Toyota extended warranty UK'),
  '/warranty-types/vans-warranty/': buildBody(FACTS.vans, 'Van warranty UK'),
  '/warranty-types/vauxhall-warranty/': buildBody(FACTS.vauxhall, 'Vauxhall extended warranty UK'),
  '/warranty-types/volkswagen-warranty/': buildBody(FACTS.volkswagen, 'Volkswagen extended warranty UK'),
  '/thewarrantyhub/tesla-warranty-uk-2026-battery-cover-repair-costs-extended-options/': {
    h1: 'Tesla Warranty UK 2026: Battery Cover, Repair Costs & Extended Options Explained',
    intro:
      "Driving a Tesla in the UK saves money on fuel and routine servicing, but many owners are caught off guard when the factory cover ends. This guide explains what the manufacturer warranty includes, what common repairs cost at UK rates, and how to stay protected once the guarantee expires.",
    sections: [
      {
        h2: 'What is the Tesla UK warranty?',
        paras: [
          "The basic vehicle limited warranty runs for 4 years or 60,000 miles, whichever comes first. A separate battery and drive unit warranty lasts 8 years, with mileage limits from 100,000 miles on standard rear-wheel-drive models up to 150,000 miles on flagship models. Wear and tear items such as tyres, wiper blades and cabin filters are not included.",
        ],
        points: [
          {
            h3: 'Battery capacity guarantee',
            text: 'The battery warranty guarantees at least 70% capacity retention across its 8-year term, so a pack that falls below that threshold through normal use is repaired or replaced.',
          },
          {
            h3: 'Why the battery cover matters',
            text: 'A replacement pack can cost £8,000 to £15,000 in the UK, which makes the 8-year battery and drive unit term the most valuable part of the manufacturer guarantee.',
          },
        ],
      },
      {
        h2: 'Typical Tesla out-of-warranty repair costs in the UK',
        paras: [
          'Once the 4-year basic cover ends, repair bills fall to the owner. Suspension control arms and bushes wear early because of the floor-mounted battery weight, typically £800 to £2,500 to overhaul. Replacing a faulty touchscreen or Media Control Unit runs £1,500 to £2,300, and official diagnostic fees start around £115 before any work begins.',
        ],
      },
      {
        h2: 'Tesla extended warranty versus independent cover',
        paras: [
          "Official extended cover in the UK has largely moved to a monthly subscription or a powertrain-only add-on with deductibles and manufacturer-only repairs. Independent EV specialists cover vehicles up to 15 years old and 150,000 miles, include sudden high-voltage battery failure, and let you use any VAT-registered UK garage.",
        ],
      },
      {
        h2: 'How to choose when your warranty expires',
        paras: [
          'Match the cover to the age, mileage and budget of the car. Look for a policy that explicitly includes the infotainment screen, motorised charging flap and safety sensors, and confirm that sudden high-voltage battery failure is written into the terms rather than excluded.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does the standard warranty cover the 12v battery?',
        a: 'The basic 4-year or 60,000-mile limited warranty covers the low-voltage 12v battery against manufacturing defects. After that period you pay for a replacement yourself or rely on an extended warranty plan.',
      },
      {
        q: 'How much does it cost to fix Tesla suspension issues in the UK?',
        a: 'Suspension repairs typically range from £800 to £2,500 depending on the wear and local labour rates. Control arms and lateral links often need replacing after 40,000 miles because of the weight of the floor-mounted battery.',
      },
      {
        q: 'What happens when the 8-year battery warranty ends?',
        a: 'You become responsible for all high-voltage battery and drive unit repairs. A full battery replacement can cost upwards of £8,000, which is why independent EV cover suits older models.',
      },
      {
        q: 'Is the official extended warranty still available as a lump sum?',
        a: 'Largely no. UK extended cover has shifted to a monthly subscription model, so many drivers prefer independent warranties with fixed terms and a free choice of repairer.',
      },
      {
        q: 'Do third-party warranties cover natural battery degradation?',
        a: 'No. Independent warranties cover sudden, unforeseen mechanical or electrical failure of the battery pack and its management systems, not gradual chemical capacity loss.',
      },
    ],
  },
  '/thewarrantyhub/petrol-diesel-vehicle-warranty-cover-complete-uk-drivers-guide/': {
    h1: "Petrol & Diesel Vehicle Warranty Cover: Complete UK Driver's Guide",
    intro:
      "Petrol and diesel cars contain hundreds of stressed mechanical parts, turbocharging assemblies and sensor arrays that wear with mileage, vibration and heat. This guide sets out exactly which components an extended warranty protects, what UK garage repairs cost without cover, and how Block Exemption rules keep your choice of garage open.",
    sections: [
      {
        h2: 'What components are covered in petrol and diesel plans?',
        paras: [
          'Comprehensive cover spans the engine core, the transmission and driveline, and the electrical and running gear that modern cars depend on. A dedicated used car warranty bridges the gap once the three-year factory guarantee expires.',
        ],
        points: [
          {
            h3: 'Engine and mechanical core',
            text: 'Pistons, rings, gudgeon pins, crankshafts, main bearings, camshafts, valves and guides, timing gears, tensioners, oil pumps and cylinder head gaskets, plus turbochargers, variable-geometry turbos, superchargers, wastegate actuators and intercoolers, high-pressure injection pumps, injectors, MAF sensors, throttle bodies and fuel pressure regulators.',
          },
          {
            h3: 'Gearbox, transmission and driveline',
            text: 'Manual gearboxes, torque-converter automatics, DCT/DSG units, synchromesh assemblies, selector shafts and mechatronic modules, along with drive shafts, universal and CV joints, crown wheels, pinions, differentials and dual-mass flywheels.',
          },
          {
            h3: 'Ancillaries, electrics and running gear',
            text: 'Alternators, starter motors, ignition coils, central locking solenoids, window and wiper motors and ECUs, plus ABS pumps and modules, brake master cylinders, wheel bearing hub units, coil springs and power steering pumps.',
          },
        ],
      },
      {
        h2: 'Petrol versus diesel component failure and UK repair costs',
        paras: [
          'Without cover, fuel delivery faults run £650 to £1,800, turbocharger work £800 to £2,200 and driveline or bearing repairs £250 to £1,400. Diagnostic time is charged at roughly £90 to £180 per hour. Petrol cars tend to suffer injector fouling and sensor misfires; diesels see high-pressure pump wear, DPF sensor blockage, carbon build-up and sticking VNT vanes.',
        ],
      },
      {
        h2: 'Why modern ICE vehicles need diagnostic and wear protection',
        paras: [
          'Road salt, potholes and stop-start traffic wear suspension and bearing assemblies, so a sealed hub unit replacement costs hundreds of pounds in parts and labour. When a sensor detects an abnormal air-fuel ratio or ignition timing it triggers the engine management light, and tracing the cause needs OBD-II scanning and technician time. Comprehensive cover pays both the diagnostic fee and the replacement part.',
        ],
      },
      {
        h2: 'How UK Block Exemption rules protect your choice of garage',
        paras: [
          'Under the UK Motor Vehicle Block Exemption Regulations you may use any VAT-registered workshop for servicing and warranty repairs rather than a franchised dealer. Keep claims straightforward by following the manufacturer service intervals, using genuine or OE-equivalent parts and fluids, and retaining itemised invoices for every visit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What should I do immediately when my engine management light comes on?',
        a: 'Book a VAT-registered garage for a diagnostic fault code scan. If the fault traces to a covered mechanical or electrical part such as a sensor, injector or valve, both the diagnostic fee and the replacement cost are eligible under your policy.',
      },
      {
        q: 'Does a petrol or diesel vehicle warranty cover a noisy wheel bearing?',
        a: 'Yes. Front and rear wheel bearing assemblies and complete hub units are covered against sudden mechanical failure and premature wear.',
      },
      {
        q: 'Can I use my choice of local independent garage for warranty repairs in the UK?',
        a: 'Yes. Block Exemption rules allow any VAT-registered garage in England, Scotland, Wales or Northern Ireland, provided the garage obtains claim authorisation before starting work.',
      },
      {
        q: 'Are turbochargers fully covered under petrol and diesel plans?',
        a: 'Yes. Petrol and diesel turbocharger units, internal wastegates, variable geometry actuators and intercoolers are protected against mechanical breakdown.',
      },
      {
        q: 'What items are excluded from standard petrol and diesel vehicle protection?',
        a: 'Routine consumables and wear items: brake discs and pads, tyres, clutch friction plates, exhaust pipes and servicing fluids.',
      },
    ],
  },
};

export function getPageBody(path: string): PageBody | undefined {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return PAGE_BODIES[withSlash];
}
