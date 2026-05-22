import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Repeat,
  Settings as Cog,
  PauseCircle,
  AlertTriangle,
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';

const CancellationPolicy: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#F9FAFB] text-[#111827]">
      <SEOHead
        title="Cancellation Policy | Buyawarranty"
        description="Read our clear and simple warranty cancellation policy. 14-day cooling-off period, pro-rata refunds, £40 processing fee. UK-based support team."
        keywords="cancellation policy, warranty cancellation, refund policy, buyawarranty"
      />

      {/* Hero */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">
            Policy management
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Cancellation policy</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#6B7280]">
            Hopefully you'll never need this — but if you do, here's everything explained simply and fairly.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Section 1: Retention Options */}
        <section aria-labelledby="before-you-cancel" className="mb-14">
          <SectionHeader id="before-you-cancel" number={1} title="Before you cancel, consider your options" />

          <p className="mb-6 max-w-3xl text-sm leading-6 text-[#6B7280]">
            Most customers find one of these options works better than cancelling. Our team can help you choose the best route.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <OptionCard
              Icon={Repeat}
              title="Transfer your policy"
              body="Moving home or changing vehicle? You can transfer your cover — often at no extra cost."
              ctaText="Ask about transferring"
              ctaHref="/contact-us/"
            />
            <OptionCard
              Icon={Cog}
              title="Adjust your cover"
              body="Need to reduce your cost? We can tailor your cover to better suit your needs."
              ctaText="Explore cover options"
              ctaHref="/contact-us/"
            />
            <OptionCard
              Icon={PauseCircle}
              title="Pause your policy"
              body="Not using your vehicle? You may be able to pause your cover temporarily."
              ctaText="Ask about pausing"
              ctaHref="/contact-us/"
            />
          </div>
        </section>

        {/* Section 2: Cancellation Rules */}
        <section aria-labelledby="cancelling-your-policy" className="mb-14">
          <SectionHeader id="cancelling-your-policy" number={2} title="Cancelling your policy" />

          <div className="space-y-6">
            {/* Within 14 days */}
            <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="mb-2 inline-flex rounded-full bg-[#E8F7EE] px-3 py-1 text-xs font-bold text-[#16A34A]">
                    Days 1–14
                  </span>
                  <h3 className="text-lg font-bold">Cancelling within the first 14 days</h3>
                </div>
                <span className="text-sm font-medium text-[#6B7280]">Cooling-off period</span>
              </div>

              <p className="text-sm leading-6 text-[#374151]">
                Your cover starts immediately from the day you purchase. If you cancel within 14 days and no claim has been made or is in progress, you'll receive a refund minus the days you've been covered and a £40 processing fee.
              </p>

              <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EB]">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-sm">
                  <thead className="bg-[#111827] text-white">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Day you cancel</th>
                      <th className="px-4 py-3 font-semibold">Days used</th>
                      <th className="px-4 py-3 font-semibold">Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#374151]">
                    {[
                      { d: 'Day 3', used: '3 days', amount: '3/365 of your cover plus £40' },
                      { d: 'Day 7', used: '7 days', amount: '7/365 of your cover plus £40' },
                      { d: 'Day 14', used: '14 days', amount: '14/365 of your cover plus £40' },
                    ].map((row) => (
                      <tr key={row.d}>
                        <td className="px-4 py-3 font-medium">{row.d}</td>
                        <td className="px-4 py-3">{row.used}</td>
                        <td className="px-4 py-3">{row.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            {/* After 14 days */}
            <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="mb-2 inline-flex rounded-full bg-[#E8F7EE] px-3 py-1 text-xs font-bold text-[#16A34A]">
                    After day 14
                  </span>
                  <h3 className="text-lg font-bold">Cancelling after 14 days — no claim made</h3>
                </div>
                <span className="text-sm font-medium text-[#6B7280]">No claim in progress</span>
              </div>

              <p className="text-sm leading-6 text-[#374151]">
                You'll receive a pro-rata refund based on the unused time remaining, minus a £40 processing fee. We'll confirm your cancellation and any refund within 5 to 7 working days of receiving your request.
              </p>
            </article>

            {/* Claim made warning */}
            <article className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#F59E0B] text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <span className="mb-2 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#B45309]">
                    Any time
                  </span>
                  <h3 className="text-lg font-bold">If you've made a claim</h3>
                </div>
              </div>

              <div className="rounded-xl bg-white/70 p-5">
                <p className="text-sm font-semibold leading-6 text-[#111827]">
                  Once a claim has been submitted, your policy continues for the full term and isn't eligible for cancellation or refund.
                </p>
                <p className="mt-3 text-sm leading-6 text-[#374151]">
                  This is because costs are incurred immediately when a claim is made and your cover remains active for the full period.
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-[#374151]">
                  {[
                    'Your claim is assessed and processed immediately.',
                    'Repair costs begin from the point of approval.',
                    'Your cover continues for future issues until expiry.',
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#F59E0B]" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
        </section>

        {/* Section 3: Quick Summary */}
        <section aria-labelledby="quick-summary" className="mb-14">
          <SectionHeader id="quick-summary" number={3} title="Quick summary" />

          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-sm">
              <thead className="bg-[#F97316] text-white">
                <tr>
                  <th className="px-5 py-4 font-bold">Your situation</th>
                  <th className="px-5 py-4 font-bold">What you get back</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {[
                  { sit: 'Cancel within 14 days, no claim made', out: '✓ Refund minus days of cover and a £40 processing fee', good: true },
                  { sit: 'Cancel within 14 days, claim made or in progress', out: '⚠ Policy continues — no refund', good: false },
                  { sit: 'Cancel after 14 days, no claim made', out: '✓ Refund minus days of cover and a £40 processing fee', good: true },
                  { sit: 'Cancel after 14 days, claim made, in progress or completed', out: '⚠ Policy continues — no refund', good: false },
                ].map((row, i) => (
                  <tr key={row.sit} className={i % 2 === 1 ? 'bg-[#F9FAFB]' : ''}>
                    <td className="px-5 py-4 text-[#374151]">{row.sit}</td>
                    <td className={`px-5 py-4 font-semibold ${row.good ? 'text-[#16A34A]' : 'text-[#B45309]'}`}>
                      {row.out}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: How to Cancel */}
        <section aria-labelledby="how-to-cancel" className="mb-14">
          <SectionHeader id="how-to-cancel" number={4} title="How to cancel your policy" />

          <div className="space-y-4">
            <HowStep n={1} title="Submit your request">
              Complete the short form at{' '}
              <Link to="/cancel-warranty" className="font-semibold text-[#F97316] hover:text-[#EA580C]">
                buyawarranty.co.uk/cancel-warranty
              </Link>.
            </HowStep>
            <HowStep n={2} title="We process your request">
              We'll confirm your cancellation and any refund within 3 working days.
            </HowStep>
            <HowStep n={3} title="Need help first?">
              Our UK team can walk you through your options before you cancel.
            </HowStep>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="need-help" className="rounded-3xl border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">
          <h2 id="need-help" className="text-2xl font-bold">Need help with your policy?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
            Most customers find a better option than cancelling — our team is here to help.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="tel:03302295040"
              className="inline-flex items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-200"
            >
              Speak to our team
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <Link
              to="/cancel-warranty"
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#F9FAFB] focus:outline-none focus:ring-4 focus:ring-gray-200"
            >
              Continue to cancellation
            </Link>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-[#6B7280] sm:flex-row sm:gap-6">
            <span>
              📞 Claims & complaints:{' '}
              <a href="tel:03302295040" className="font-bold text-[#111827] hover:text-[#F97316]">
                0330 229 5040
              </a>
            </span>
            <span>Mon to Fri, 9am to 5:30pm</span>
          </div>
        </section>

        <p className="mt-10 text-center text-xs leading-5 text-[#9CA3AF]">
          This cancellation policy forms part of your full terms and conditions.
        </p>
      </div>

      <ScrollToTopButton />
    </main>
  );
};

/* ---------- helper sub-components ---------- */

const SectionHeader: React.FC<{ id: string; number: number; title: string }> = ({ id, number, title }) => (
  <div className="mb-6 flex items-center gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4EC] text-sm font-bold text-[#F97316]">
      {number}
    </span>
    <h2 id={id} className="text-2xl font-bold">
      {title}
    </h2>
  </div>
);

const OptionCard: React.FC<{
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ctaText: string;
  ctaHref: string;
}> = ({ Icon, title, body, ctaText, ctaHref }) => (
  <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4EC] text-[#F97316]">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="text-base font-bold">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{body}</p>
    <Link to={ctaHref} className="mt-4 inline-flex text-sm font-semibold text-[#F97316] hover:text-[#EA580C]">
      {ctaText} →
    </Link>
  </article>
);

const HowStep: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <article className="flex gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F97316] text-sm font-bold text-white">
      {n}
    </span>
    <div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#6B7280]">{children}</p>
    </div>
  </article>
);

export default CancellationPolicy;
