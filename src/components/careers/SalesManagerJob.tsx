import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Home, PoundSterling, TrendingUp, Headphones, GraduationCap, Users, CheckCircle2, Briefcase, Laptop, Clock, Award, Phone, LineChart, Sun, Sunrise, Sunset } from 'lucide-react';
import CareersApplyBlock from '@/components/careers/CareersApplyBlock';
import careersHeroImage from '@/assets/telesales-sales-manager-vehicle-warranty-jobs-buyawarranty.png.asset.json';

export const SALES_MANAGER_ROLE = 'Remote Telesales Team Manager – KPI Management, Coaching & Sales Performance';

const SM_KEYWORDS = 'remote telesales team manager jobs, telesales manager jobs, sales manager jobs, remote sales manager, telesales team leader, call centre sales manager, contact centre manager jobs, vehicle warranty sales manager, warranty sales team leader, car warranty sales manager, inbound sales manager, outbound sales manager, remote team leader jobs, sales coaching jobs, KPI management jobs, sales performance manager, motor finance sales manager, car finance team leader, dealership sales manager, F&I manager jobs, GAP insurance sales manager, insurance sales manager, automotive account manager, vehicle warranty sales jobs, warranty manager jobs, used car sales manager jobs, motor trade sales executive, automotive aftermarket sales, B2B telesales jobs, outbound telesales jobs UK, work from home sales jobs, uncapped commission, insurance sales jobs, financial services sales, buyawarranty careers';

const dailyManagement = [
  "Ensure all team members are logged in, available and ready to work at their scheduled start times",
  "Monitor staff attendance, punctuality, availability and adherence to working schedules",
  "Maintain regular telephone and online contact with individual sales executives throughout the day",
  "Actively monitor staff productivity and ensure working time is being used effectively",
  "Identify agents who are inactive, falling behind or not meeting expected activity levels",
  "Contact team members directly to address performance concerns and provide support",
  "Keep the team focused, disciplined, motivated and accountable",
  "Conduct daily team briefings, individual check-ins and performance follow-ups",
  "Maintain strong communication and management presence despite the team working remotely",
];

const kpiMonitoring = [
  "Monitor live sales dashboards, CRM activity and performance reports",
  "Track individual and team KPIs throughout the working day",
  "Monitor call volumes, talk time, leads handled, conversion rates, sales achieved and revenue generated",
  "Ensure every salesperson understands their individual daily sales targets",
  "Identify underperformance early and take immediate corrective action",
  "Proactively telephone or speak with agents who are falling behind",
  "Maintain regular performance check-ins to keep sales executives on track",
  "Set clear expectations and hold individuals accountable for agreed performance standards",
  "Identify patterns affecting sales productivity and implement practical improvements",
  "Take ownership of daily, weekly and monthly team results",
];

const coaching = [
  "Listen to sales calls and assess sales techniques",
  "Provide regular, practical one-to-one coaching",
  "Improve objection handling, customer engagement, product presentation and closing techniques",
  "Identify why individual salespeople are not converting leads effectively",
  "Work directly with underperforming agents to improve their results",
  "Deliver structured performance improvement plans where required",
  "Mentor team members and build their confidence and sales ability",
  "Identify successful techniques used by top performers and share them across the team",
  "Provide immediate feedback and support when performance problems arise",
  "Create a results-driven environment where people are continuously developing",
];

const training = [
  "Deliver ongoing remote sales training and refresher sessions",
  "Train employees on sales processes, objection handling and closing techniques",
  "Support the onboarding and development of new sales executives",
  "Identify knowledge gaps and arrange targeted training",
  "Improve consistency in sales conversations and customer handling",
  "Ensure salespeople understand Buyawarranty's products, processes and sales expectations",
  "Help build a skilled, confident and high-performing remote sales team",
];

const revenue = [
  "Take responsibility for the team's overall sales performance and target achievement",
  "Improve conversion rates and maximise revenue from available sales opportunities",
  "Analyse individual and team sales results to identify areas for improvement",
  "Ensure leads are handled promptly and effectively",
  "Reduce missed sales opportunities and avoidable underperformance",
  "Support sustainable revenue growth through better team productivity and sales execution",
  "Maintain strong customer service standards and ensure sales activity follows company compliance requirements",
];

const reporting = [
  "Provide daily updates on team sales performance and target achievement",
  "Report on attendance, activity levels, conversion rates and revenue",
  "Highlight underperforming team members and actions being taken",
  "Explain performance trends and identify potential problems before they escalate",
  "Provide weekly and monthly performance summaries",
  "Recommend practical improvements to increase team productivity and sales results",
  "Take accountability for the management actions required to achieve agreed targets",
];

const recruitment = [
  "Assist with interviewing and selecting new sales executives",
  "Support onboarding and initial training",
  "Help develop consistent training and performance standards",
  "Identify potential future team leaders",
  "Support the growth of a structured and scalable remote sales operation",
];

const essentials = [
  "Significant experience as a Telesales Manager, Sales Team Manager or Contact Centre Sales Manager",
  "Proven success managing and improving telesales teams day to day, not just reporting on them",
  "Strong experience with telephone sales, conversions and performance coaching",
  "Experience managing remote or distributed sales teams",
  "Hands-on approach: actively involved with the team throughout the working day",
  "Excellent leadership, communication and motivational skills",
  "Strong understanding of sales targets, CRM reporting and KPIs",
  "Experience recruiting, training and developing salespeople",
  "Ability to demonstrate that your coaching has genuinely improved sales performance",
];

const industries = [
  "Vehicle warranty sales",
  "Automotive or motor trade sales",
  "Insurance, financial services or related telesales",
  "Managing high-volume inbound sales operations",
  "Telesales Manager / Contact Centre Sales Manager",
  "Car Finance Sales Manager / Motor Finance Team Leader",
  "Dealership Sales Manager / F&I Manager",
];

const benefits = [
  'Fully remote: manage the team from anywhere in the UK',
  'Flexible engagement: PAYE employment or a suitable self-employed arrangement',
  '£45,000 PAYE basic salary plus uncapped commission, or an agreed contractor package',
  'Uncapped commission — the better the team performs, the more you earn',
  'Up to £80,000 a year for exceptional performance',
  'Real ownership of daily sales performance, coaching and team results',
  'Benefit financially from the success of the team you manage',
  'Report directly to senior management with real influence on how the team runs',
];

export const SalesManagerJob: React.FC = () => (
  <>
    <Helmet>
      <title>Remote Telesales Team Manager Jobs UK – KPI Management & Coaching | Buyawarranty</title>
      <meta name="description" content="Experienced Remote Telesales Team Manager wanted to own daily sales performance, KPIs and coaching at Buyawarranty. £45,000 PAYE basic plus uncapped commission, up to £80,000. PAYE or self-employed." />
      <meta name="keywords" content={SM_KEYWORDS} />
    </Helmet>

    <section className="bg-white border-b border-[#E5E7EB]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">We're hiring</div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Careers at Buya<span className="text-brand-orange">warranty</span></h1>
            <p className="mt-4 text-lg font-semibold text-[#111827]">Remote Telesales Team Manager – KPI Management, Coaching &amp; Sales Performance</p>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
              <span className="font-bold">Fully remote</span> (anywhere in the UK) · Full-time · PAYE or self-employed · £45,000 basic + uncapped commission · Up to £80,000 for exceptional performance
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#apply" className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200">
                Apply now<ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#role" className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB]">View the role</a>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={careersHeroImage.url} alt="Remote telesales team manager job in vehicle warranties – Miles the Buyawarranty panda leading a line-up of a car, van, SUV and motorbike" width={1920} height={640} className="w-full max-w-2xl h-auto object-contain" loading="eager" />
          </div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section id="role" aria-labelledby="sm-about" className="mb-14">
        <Header id="sm-about" n={1} title="About the role" />
        <div className="space-y-4 text-sm leading-7 text-[#374151]">
          <p>Buyawarranty is a growing UK vehicle warranty company, and we're looking for an experienced, highly motivated and hands-on <strong>Remote Telesales Team Manager</strong> to take responsibility for the daily management, productivity and performance of our remote sales team.</p>
          <p><strong>This is not a traditional Sales Manager position focused primarily on strategy, business development or managing your own sales pipeline.</strong> We need someone who is actively involved in managing salespeople throughout the working day, ensuring staff are online, productive, motivated, achieving their KPIs and consistently working towards their sales targets.</p>
          <p>You will be responsible for monitoring sales activity, maintaining daily accountability, coaching underperforming team members, improving conversion rates and ensuring the team delivers strong, consistent results. We are looking for someone who doesn't just review sales figures at the end of the day, but actively manages performance as it happens.</p>
          <p><strong>Your primary responsibility is simple: make sure our remote sales team is working effectively, improving continuously and achieving its sales targets.</strong></p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Perk Icon={Briefcase} title="Option 1 – PAYE employment" body="£45,000 annual basic salary, uncapped commission linked to qualifying team performance, full-time remote employment with applicable benefits and statutory entitlements. Up to £80,000 a year for exceptional performance." />
          <Perk Icon={Award} title="Option 2 – Self-employed" body="For suitably experienced professionals where the arrangement genuinely supports self-employed status. Contractual management fee plus uncapped performance commission, subject to agreement, up to £80,000 a year." />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">The arrangement, payment structure and performance expectations will be agreed before you start, subject to the correct legal and tax status.</p>
      </section>

      <section aria-labelledby="sm-earn" className="mb-14">
        <Header id="sm-earn" n={2} title="Performance and earnings tiers (PAYE)" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Earn tier="Tier 1 – Successful" range="£60,000" note="£45,000 basic + illustrative £15,000 commission" />
          <Earn tier="Tier 2 – High performance" range="£70,000" note="£45,000 basic + illustrative £25,000 commission" highlight />
          <Earn tier="Tier 3 – Exceptional" range="£80,000" note="£45,000 basic + illustrative £35,000 commission" />
        </div>
        <p className="mt-4 text-xs text-[#6B7280]">Commission is uncapped and linked to agreed qualifying sales and performance targets. These tiers are illustrative, and earnings above the basic salary are not guaranteed. Self-employed remuneration is negotiated separately.</p>
      </section>

      <section aria-labelledby="sm-resp" className="mb-14">
        <Header id="sm-resp" n={3} title="Your key responsibilities" />
        <div className="space-y-8">
          <RespGroup title="Daily remote team management & accountability" intro="You will take full ownership of the day-to-day management of our remote sales executives." items={dailyManagement} note="We need someone who knows exactly how their team is performing throughout the day, not just at the end of it." />
          <RespGroup title="Daily KPI monitoring & sales target achievement" intro="You will be directly responsible for monitoring, managing and improving individual and team sales performance." items={kpiMonitoring} note="Success in this role means actively driving results, rather than simply reporting on them." />
          <RespGroup title="Sales coaching, mentoring & performance improvement" intro="A major part of this role is helping salespeople become more effective and achieve higher conversion rates." items={coaching} note="We are looking for someone who can demonstrate that their coaching has genuinely improved sales performance." />
          <RespGroup title="Remote sales training & development" items={training} />
          <RespGroup title="Sales performance, conversion & revenue" items={revenue} />
          <RespGroup title="Reporting & management communication" intro="You will report directly to senior management and provide clear visibility of the team's performance." items={reporting} />
          <RespGroup title="Recruitment & team development" intro="As the business grows, you will also support the expansion of our remote sales team." items={recruitment} />
        </div>
      </section>

      <section aria-labelledby="sm-day" className="mb-14">
        <Header id="sm-day" n={4} title="What a typical working day looks like" />
        <p className="mb-4 text-sm leading-7 text-[#374151]">This is an active, hands-on management position. Your working day will involve:</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={Sunrise} title="Start of the day" body="Check all scheduled sales agents are online and ready to work. Review previous performance and communicate daily targets. Identify individuals requiring additional attention." />
          <Perk Icon={Sun} title="Throughout the morning" body="Monitor live sales activity and productivity. Check agents are on track with expected activity and sales targets. Contact individuals who are falling behind. Listen to calls and provide coaching." />
          <Perk Icon={Sunset} title="Throughout the afternoon" body="Continue monitoring sales figures and conversion rates. Follow up with agents who need support, keep the team motivated through to the end of the day, and prepare your daily performance update for senior management." />
        </div>
      </section>

      <section aria-labelledby="sm-skills" className="mb-14">
        <Header id="sm-skills" n={5} title="Essential experience" />
        <p className="mb-4 text-sm leading-7 text-[#374151]">We are looking for an exceptional, experienced telesales leader with a proven record of delivering results through a team.</p>
        <Ticks items={essentials} />
      </section>

      <section aria-labelledby="sm-industry" className="mb-14">
        <Header id="sm-industry" n={6} title="Desirable experience" />
        <Ticks items={industries} />
      </section>

      <section aria-labelledby="sm-hours" className="mb-14">
        <Header id="sm-hours" n={7} title="Working hours" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Perk Icon={Clock} title="Monday to Friday" body="Standard weekday hours, fully remote." />
          <Perk Icon={Clock} title="Saturday half day" body="Twice a month, and flexible when you need it to reach targets." />
          <Perk Icon={Laptop} title="No travel" body="Fully remote, with no field sales or travel requirements." />
        </div>
      </section>

      <section aria-labelledby="sm-benefits" className="mb-14">
        <Header id="sm-benefits" n={8} title="Why join Buyawarranty?" />
        <Ticks items={benefits} />
        <p className="mt-4 text-sm text-[#6B7280]">Both PAYE employment and self-employed arrangements can be considered, subject to the nature of the working relationship and applicable requirements.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Perk Icon={GraduationCap} title="Full training" body="Product training and ongoing support from day one." />
          <Perk Icon={Headphones} title="Ongoing support" body="A supportive team behind you from day one." />
          <Perk Icon={TrendingUp} title="Earnings upside" body="Uncapped commission linked to qualifying team performance." />
        </div>
      </section>

      <section id="apply" aria-labelledby="sm-apply" className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EC] text-[#F97316]"><Award className="h-6 w-6" /></div>
          <h2 id="sm-apply" className="text-2xl font-bold">Apply for the Remote Telesales Team Manager role</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">If you're an experienced telesales team manager who can demonstrate success driving daily performance, coaching salespeople and improving conversions, we'd like to hear from you. Own the numbers. Coach the team. Be rewarded for results.</p>
        </div>
        <div className="mt-8 rounded-2xl bg-[#F9FAFB] p-6 border border-[#E5E7EB]">
          <p className="text-sm font-semibold text-[#111827] mb-3">Please submit your CV with a short note explaining:</p>
          <ul className="space-y-2 text-sm text-[#374151]">
            {['The size and type of telesales teams you have managed day to day', 'How your coaching and KPI management measurably improved team results', 'Any vehicle warranty, automotive or insurance sales background'].map(l => (
              <li key={l} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-[#F97316] mt-0.5 flex-none" /><span>{l}</span></li>
            ))}
          </ul>
        </div>
        <CareersApplyBlock role={SALES_MANAGER_ROLE} experienceLabel="I have significant experience managing a telesales or contact-centre sales team" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Summary Icon={Briefcase} label="Job type" value="Full-time" />
          <Summary Icon={Award} label="Employment type" value="PAYE or self-employed" />
          <Summary Icon={Home} label="Location" value="Remote, United Kingdom" />
          <Summary Icon={PoundSterling} label="PAYE basic" value="£45,000 + uncapped commission" />
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
const RespGroup = ({ title, intro, items, note }: { title: string; intro?: string; items: string[]; note?: string }) => (
  <div>
    <h3 className="mb-2 text-lg font-bold text-[#111827]">{title}</h3>
    {intro && <p className="mb-3 text-sm leading-7 text-[#374151]">{intro}</p>}
    <Ticks items={items} />
    {note && <p className="mt-3 text-sm font-semibold text-[#111827]">{note}</p>}
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
