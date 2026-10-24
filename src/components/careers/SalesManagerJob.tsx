import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Home, PoundSterling, TrendingUp, Headphones, GraduationCap, Users, CheckCircle2, Briefcase, Laptop, Clock, Award, Phone } from 'lucide-react';
import CareersApplyBlock from '@/components/careers/CareersApplyBlock';
import careersHeroImage from '@/assets/telesales-sales-manager-vehicle-warranty-jobs-buyawarranty.png.asset.json';

export const SALES_MANAGER_ROLE = 'Telesales Sales Manager – Vehicle Warranties';

const SM_KEYWORDS = 'sales manager jobs, telesales manager jobs, remote sales manager, telesales team leader, call centre sales manager, contact centre manager jobs, vehicle warranty sales manager, warranty sales team leader, car warranty sales manager, inbound sales manager, outbound sales manager, remote team leader jobs, motor finance sales manager, car finance team leader, dealership sales manager, F&I manager jobs, GAP insurance sales manager, insurance sales manager, business development manager jobs, BDM jobs remote, automotive business development manager, warranty business development manager, dealer relationship manager jobs, dealer account manager, automotive account manager, car finance business development manager, motor finance BDM, dealer finance account manager, car finance broker jobs, motor finance broker jobs, vehicle warranty sales jobs, warranty sales executive, warranty manager jobs, used car sales manager jobs, motor trade sales executive, automotive aftermarket sales, GAP insurance sales jobs, vehicle protection products sales, B2B telesales jobs, outbound telesales jobs UK, cold calling jobs, new business sales jobs, remote B2B sales jobs, work from home sales jobs, uncapped commission, insurance sales jobs, financial services sales, recruitment sales jobs, buyawarranty careers';

const responsibilities = [
  "Lead and manage the entire remote sales team",
  "Motivate, coach and develop high-performing sales executives",
  "Run regular performance reviews and team meetings",
  "Set and monitor individual and team targets",
  "Identify underperformance and put improvement plans in place",
  "Maintain accountability, productivity and high standards across the team",
  "Take ownership of sales conversions, team revenue and performance",
  "Monitor daily, weekly and monthly KPIs",
  "Improve sales techniques and closing rates",
  "Review sales calls and deliver targeted coaching",
  "Develop strategies to maximise revenue and profitability",
  "Ensure consistent customer service and compliant sales practices",
  "Help recruit and onboard new remote sales executives",
  "Build structured training and coaching programmes",
  "Build a scalable, successful remote sales operation and spot future team leaders",
  "Report directly to senior management with accurate updates and forecasts",
  "Monitor CRM data and sales reporting, and identify operational improvements",
  "Take responsibility for team results and commercial performance",
];

const essentials = [
  "Significant experience as a Sales Manager, Telesales Manager or Contact Centre Sales Manager",
  "Proven success managing and improving sales teams",
  "Strong experience with telephone sales, conversions and performance coaching",
  "Experience managing remote or distributed sales teams",
  "Excellent leadership, communication and motivational skills",
  "Strong understanding of sales targets, CRM reporting and KPIs",
  "Experience recruiting, training and developing salespeople",
  "Ability to demonstrate measurable commercial achievements",
];

const industries = [
  "Vehicle warranty sales",
  "Automotive or motor trade sales",
  "Insurance, financial services or related telesales",
  "Managing high-volume inbound sales operations",
  "Growing and scaling sales teams",
  "Telesales Manager / Contact Centre Sales Manager",
  "Car Finance Sales Manager / Motor Finance Team Leader",
  "Dealership Sales Manager / F&I Manager",
];

const benefits = [
  'Fully remote: manage the team from anywhere in the UK',
  'Flexible engagement: PAYE employment or a suitable self-employed arrangement',
  '£45,000 PAYE basic salary plus commission, or an agreed contractor package',
  'Up to £80,000 a year for exceptional results',
  'Lead an expanding sales operation in a growing business',
  'Real responsibility for team performance, recruitment and development',
  'Benefit financially from the success of the team you manage',
  'Help shape the future of our sales operation',
];

export const SalesManagerJob: React.FC = () => (
  <>
    <Helmet>
      <title>Remote Telesales Sales Manager Jobs UK – Vehicle Warranties | Buyawarranty</title>
      <meta name="description" content="Exceptional, experienced Sales Manager wanted to lead Buyawarranty's fully remote sales team. £45,000 PAYE basic plus commission, up to £80,000. PAYE or self-employed." />
      <meta name="keywords" content={SM_KEYWORDS} />
    </Helmet>

    <section className="bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">We're hiring</div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Careers at Buyawarranty</h1>
            <p className="mt-4 text-lg font-semibold text-[#111827]">Experienced Sales Manager – Lead, Build & Grow Our Remote Sales Team</p>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
              <span className="font-bold">Fully remote</span> (anywhere in the UK) · Full-time · PAYE or self-employed · £45,000 basic + performance commission · Up to £80,000 for exceptional performance
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200">
                Apply now<ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#role" className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]">View the role</a>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={careersHeroImage.url} alt="Remote telesales sales manager job in vehicle warranties – Miles the Buyawarranty panda leading a line-up of a car, van, SUV and motorbike" width={1920} height={640} className="w-full max-w-2xl h-auto object-contain" loading="eager" />
          </div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section id="role" aria-labelledby="bdm-about" className="mb-14">
        <Header id="bdm-about" n={1} title="About the role" />
        <div className="space-y-4 text-sm leading-7 text-[#374151]">
          <p>Buyawarranty is a growing UK vehicle warranty company, and we're looking for an <strong>exceptional, experienced Sales Manager</strong> to take responsibility for our expanding remote sales operation.</p>
          <p>This is a senior, hands-on leadership position requiring proven experience managing sales teams, improving conversions, driving revenue and developing high-performing salespeople. You'll manage our entire remote sales team, with the opportunity to earn additional commission based on team performance and business growth.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Perk Icon={Briefcase} title="Option 1 – PAYE employment" body="£45,000 annual basic salary, commission linked to qualifying team performance, full-time remote employment with applicable benefits and statutory entitlements. Up to £80,000 a year for exceptional results." />
          <Perk Icon={Award} title="Option 2 – Self-employed" body="For suitably experienced professionals where the arrangement genuinely supports self-employed status. Management fee and performance commission negotiated by experience and responsibilities, up to £80,000 a year." />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">The arrangement, payment structure and performance expectations will be agreed before you start, subject to the correct legal and tax status.</p>
      </section>

      <section aria-labelledby="bdm-earn" className="mb-14">
        <Header id="bdm-earn" n={2} title="Performance and earnings tiers (PAYE)" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Earn tier="Tier 1 – Successful" range="£60,000" note="£45,000 basic + illustrative £15,000 commission" />
          <Earn tier="Tier 2 – High performance" range="£70,000" note="£45,000 basic + illustrative £25,000 commission" highlight />
          <Earn tier="Tier 3 – Exceptional" range="£80,000" note="£45,000 basic + illustrative £35,000 commission" />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">Commission is linked to agreed qualifying sales and performance targets. These tiers are illustrative, and earnings above the basic salary are not guaranteed. Self-employed remuneration is negotiated separately.</p>
      </section>

      <section aria-labelledby="bdm-resp" className="mb-14">
        <Header id="bdm-resp" n={3} title="Key responsibilities" />
        <Ticks items={responsibilities} />
      </section>

      <section aria-labelledby="bdm-skills" className="mb-14">
        <Header id="bdm-skills" n={4} title="Essential experience" />
        <p className="mb-4 text-sm leading-7 text-[#374151]">We are looking for an expert sales leader with a proven record of delivering results.</p>
        <Ticks items={essentials} />
      </section>

      <section aria-labelledby="bdm-industry" className="mb-14">
        <Header id="bdm-industry" n={5} title="Desirable experience" />
        <Ticks items={industries} />
      </section>

      <section aria-labelledby="bdm-hours" className="mb-14">
        <Header id="bdm-hours" n={6} title="Working hours" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={Clock} title="Monday to Friday" body="Plus a half-day on alternate Saturday mornings." />
          <Perk Icon={Clock} title="Saturday pattern" body="Part of the normal contractual pattern, with no weekday off in lieu." />
          <Perk Icon={Laptop} title="No travel" body="Fully remote, with no field sales or travel requirements." />
        </div>
      </section>

      <section aria-labelledby="bdm-benefits" className="mb-14">
        <Header id="bdm-benefits" n={7} title="Why join Buyawarranty?" />
        <Ticks items={benefits} />
        <p className="mt-4 text-sm text-[#6B7280]">Both PAYE employment and self-employed arrangements can be considered, subject to the nature of the working relationship and applicable requirements.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Perk Icon={GraduationCap} title="Full training" body="Product training and ongoing support from day one." />
          <Perk Icon={Headphones} title="Kit provided" body="Laptop, phone system and CRM for PAYE employees." />
          <Perk Icon={TrendingUp} title="Progression" body="Grow with a business expanding its sales team." />
        </div>
      </section>

      <section id="apply" aria-labelledby="bdm-apply" className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EC] text-[#F97316]"><Award className="h-6 w-6" /></div>
          <h2 id="bdm-apply" className="text-2xl font-bold">Apply for the Sales Manager role</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">If you're an experienced Sales Manager who can demonstrate success leading teams, increasing conversions and driving revenue, we'd like to hear from you. Lead the team. Drive growth. Be rewarded for results.</p>
        </div>
        <div className="mt-8 rounded-2xl bg-[#F9FAFB] p-6 border border-[#E5E7EB]">
          <p className="text-sm font-semibold text-[#111827] mb-3">Please submit your CV with a short note explaining:</p>
          <ul className="space-y-2 text-sm text-[#374151]">
            {['The size and type of sales teams you have managed', 'Your previous management achievements and team results against target', 'Any vehicle warranty, automotive or insurance sales background'].map(l => (
              <li key={l} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[#F97316] mt-0.5 flex-none" /><span>{l}</span></li>
            ))}
          </ul>
        </div>
        <CareersApplyBlock role={SALES_MANAGER_ROLE} experienceLabel="I have significant experience managing a telesales or contact-centre sales team" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Summary Icon={Briefcase} label="Job type" value="Full-time" />
          <Summary Icon={Award} label="Employment type" value="PAYE or self-employed" />
          <Summary Icon={Home} label="Location" value="Remote, United Kingdom" />
          <Summary Icon={PoundSterling} label="PAYE basic" value="£45,000 + commission" />
          <Summary Icon={TrendingUp} label="Potential" value="Up to £80,000" />
          <Summary Icon={Users} label="Team" value="Remote telesales" />
        </div>
      </section>
    </div>
  </>
);

type IconT = React.ComponentType<{ className?: string }>;
const Header = ({ id, n, title }: { id: string; n: number; title: string }) => (
  <div className="mb-6 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4EC] text-sm font-bold text-[#F97316]">{n}</span>
    <h2 id={id} className="text-2xl font-bold">{title}</h2>
  </div>
);
const Perk = ({ Icon, title, body }: { Icon: IconT; title: string; body: string }) => (
  <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F97316]"><Icon className="h-5 w-5" /></div>
    <h3 className="text-base font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
  </article>
);
const Earn = ({ tier, range, highlight, note }: { tier: string; range: string; highlight?: boolean; note?: string }) => (
  <article className={`rounded-2xl border p-6 shadow-sm ${highlight ? 'border-[#F97316] bg-[#FFF4EC]' : 'border-[#E5E7EB] bg-white'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{tier}</p>
    <p className="mt-2 text-2xl font-bold text-[#111827]">{range}</p>
    <p className="mt-2 text-xs text-[#6B7280]">{note ?? 'per year'}</p>
  </article>
);
const Ticks = ({ items }: { items: string[] }) => (
  <ul className="grid gap-3 sm:grid-cols-2">
    {items.map(i => (
      <li key={i} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-sm leading-6 text-[#374151] shadow-sm">
        <CheckCircle2 className="h-5 w-5 flex-none text-[#16A34A] mt-0.5" /><span>{i}</span>
      </li>
    ))}
  </ul>
);
const Summary = ({ Icon, label, value }: { Icon: IconT; label: string; value: string }) => (
  <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#FFF4EC] text-[#F97316]"><Icon className="h-4 w-4" /></div>
    <div><p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p><p className="mt-0.5 font-semibold text-[#111827]">{value}</p></div>
  </div>
);

export default SalesManagerJob;
