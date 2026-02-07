import React from 'react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h4 className="text-base font-bold text-gray-900">{title}</h4>
    {children}
  </div>
);

const SubSection = ({ title, items }: { title?: string; items: string[] }) => (
  <div>
    {title && <h5 className="text-xs font-semibold text-gray-800 mb-1.5">{title}</h5>}
    <ul className="space-y-0.5 text-gray-600 ml-3 text-xs">
      {items.map((item, i) => (
        <li key={i}>• {item}</li>
      ))}
    </ul>
  </div>
);

const HighPerformanceExclusionsList = () => {
  return (
    <div className="max-h-[400px] overflow-y-auto space-y-6 text-sm">
      {/* Disclaimer */}
      <div className="bg-orange-50 p-3 rounded-md">
        <p className="text-xs text-gray-700 leading-relaxed">
          We're not able to offer warranty cover for high-performance, high-end or luxury vehicles, including those with similar specifications or servicing requirements to the models listed below, as well as newer versions of the same makes and models.
        </p>
      </div>

      {/* ─── Supercars & Hypercars ─── */}
      <Section title="Supercars & Hypercars">
        <SubSection items={[
          "Bugatti (all models)",
          "Koenigsegg (all models)",
          "Pagani (all models)",
          "Rimac (all models)",
          "Hennessey (all models)",
        ]} />
      </Section>

      {/* ─── Luxury & Exotic Sports Cars ─── */}
      <Section title="Luxury & Exotic Sports Cars">
        <SubSection items={[
          "Ferrari (all models)",
          "Lamborghini (all models)",
          "McLaren (all models)",
          "Aston Martin (all current and legacy sports models, incl. Vantage, DB11, DBS, Vanquish)",
        ]} />
      </Section>

      {/* ─── Ultra-Luxury Marques ─── */}
      <Section title="Ultra‑Luxury Marques">
        <SubSection items={[
          "Rolls‑Royce (all models)",
          "Bentley (all models, including Continental GT, Flying Spur, Bentayga)",
          "Maybach (all models)",
        ]} />
      </Section>

      {/* ─── BMW M‑Series ─── */}
      <Section title="BMW M‑Series">
        <SubSection title="2 Series" items={[
          "BMW M2, M2 CS",
        ]} />
        <SubSection title="3 Series" items={[
          "BMW M3, M3 Competition, M3 CS, all M3 variants (Sedan, Touring)",
        ]} />
        <SubSection title="4 Series" items={[
          "BMW M4, M4 Competition, M4 CS, all M4 variants (Coupé, Convertible, Gran Coupé)",
        ]} />
        <SubSection title="5 Series" items={[
          "BMW M5, M5 Competition, M5 CS",
        ]} />
        <SubSection title="6 Series" items={[
          "BMW M6 (all variants)",
        ]} />
        <SubSection title="8 Series" items={[
          "BMW M8, M8 Competition (Coupé, Gran Coupé, Convertible)",
        ]} />
        <SubSection title="X Series" items={[
          "BMW X3M, X4M (all variants)",
          "BMW X5M, X6M (all variants)",
        ]} />
      </Section>

      {/* ─── Mercedes‑AMG ─── */}
      <Section title="Mercedes‑AMG (High‑Output Engines)">
        <SubSection title="GT & Sports Cars" items={[
          "AMG GT (all variants)",
          "AMG GT 4‑Door Coupé",
          "AMG SL 63 / SL 65",
        ]} />
        <SubSection title="Saloon & Estate" items={[
          "AMG S63 / S65",
          "AMG E63 / E63 S",
          "AMG CLS 63",
          "AMG C63 (all variants)",
        ]} />
        <SubSection title="Compact AMG" items={[
          "AMG A45 / CLA45 / GLA45",
        ]} />
        <SubSection title="SUVs" items={[
          "AMG G63",
          "AMG G65",
          "AMG GLC 63 / GLE 63 (all variants)",
        ]} />
      </Section>

      {/* ─── Audi RS & R8 ─── */}
      <Section title="Audi RS & R8">
        <SubSection items={[
          "Audi R8 (all)",
          "Audi RS3, RS4, RS5",
          "Audi RS6, RS7",
          "Audi RS Q3, RS Q8",
          "Audi TT RS",
        ]} />
      </Section>

      {/* ─── Porsche (High‑Performance) ─── */}
      <Section title="Porsche (High‑Performance)">
        <SubSection items={[
          "911 GT3, GT3 RS",
          "911 GT2 RS",
          "911 Turbo / Turbo S",
          "911 Carrera GTS (often excluded)",
          "718 Cayman GT4 / GT4 RS",
          "718 Spyder",
          "Panamera Turbo / Turbo S",
          "Cayenne Turbo / Turbo GT",
          "Taycan Turbo / Turbo S",
        ]} />
      </Section>

      {/* ─── Other Performance or Specialist Models ─── */}
      <Section title="Other Performance or Specialist Models">
        <SubSection items={[
          "Nissan GT‑R (all)",
          "Toyota GR Supra (some warranty providers exclude)",
          "Toyota GR Yaris / GR Corolla (varies)",
          "Lexus LC500",
          "Chevrolet Corvette (all)",
          "Dodge Challenger/Charger Hellcat, Demon, Redeye",
          "Ford Mustang Shelby GT350 / GT500",
          "Jaguar F‑Type SVR",
          "Land Rover Range Rover SVR",
          "Land Rover Defender V8 / SVX",
          "Maserati (all models: GranTurismo, MC20, Ghibli Trofeo, Levante Trofeo)",
          "Alfa Romeo Quadrifoglio models (Giulia QF, Stelvio QF)",
          "Lotus (all: Emira, Evora, Exige, Elise)",
        ]} />
      </Section>

      {/* ─── Ford Performance ─── */}
      <Section title="Ford Performance Models">
        <SubSection items={[
          "Ford Fiesta ST",
          "Ford Focus ST",
          "Ford Focus RS",
          "Ford Puma ST",
          "Ford Mustang GT",
          "Ford Mustang Mach 1",
          "Ford Mustang Mach-E GT",
          "Ford GT",
          "Ford Ranger Raptor",
        ]} />
      </Section>

      {/* ─── Vauxhall ─── */}
      <Section title="Vauxhall Performance Models">
        <SubSection items={[
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
        ]} />
      </Section>

      {/* ─── MINI ─── */}
      <Section title="MINI John Cooper Works (JCW) Models">
        <SubSection items={[
          "MINI JCW 3-Door Hatch",
          "MINI JCW Convertible",
          "MINI JCW Clubman",
          "MINI JCW Countryman",
          "MINI JCW Electric",
        ]} />
      </Section>

      {/* ─── Land Rover ─── */}
      <Section title="Land Rover Performance Models">
        <SubSection items={[
          "Range Rover Sport SVR",
          "Range Rover Sport SV",
          "Range Rover SVAutobiography Dynamic",
          "Defender V8",
          "Defender V8 Carpathian Edition",
          "Range Rover Velar SVAutobiography Dynamic Edition",
          "Range Rover SV Black",
          "Range Rover SV Carbon",
        ]} />
      </Section>

      {/* ─── Electric High‑Performance ─── */}
      <Section title="Electric High‑Performance Exclusions">
        <div className="bg-orange-50 p-2 rounded-md mb-2">
          <p className="text-xs text-gray-600">Some warranty providers exclude high‑battery‑output EVs due to powertrain costs.</p>
        </div>
        <SubSection items={[
          "Tesla Model S Plaid",
          "Tesla Model X Plaid",
          "Porsche Taycan Turbo / Turbo S",
          "Audi RS e‑tron GT",
          "Mercedes‑AMG EQS 53 / EQE 53",
        ]} />
      </Section>

      {/* ─── Kit Cars, Imports & Specialist ─── */}
      <Section title="Kit Cars, Imports & Low‑Volume Specialist Cars">
        <div className="bg-orange-50 p-2 rounded-md mb-2">
          <p className="text-xs text-gray-600">Typically excluded across the industry.</p>
        </div>
        <SubSection items={[
          "Any kit car (Caterham, Westfield, MEV, Ultima, etc.)",
          "Grey imports (non‑UK specification cars)",
          "TVR (all)",
          "Morgan (varies)",
          "Ariel Atom / Ariel Nomad",
          "BAC Mono",
        ]} />
      </Section>
    </div>
  );
};

export default HighPerformanceExclusionsList;
