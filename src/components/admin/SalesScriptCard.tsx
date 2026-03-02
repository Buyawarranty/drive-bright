import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ScriptSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: ScriptSection[] = [
  {
    id: 'opening',
    title: '1. Opening lines (rapport in 10 seconds)',
    content: (
      <>
        <p className="font-semibold text-sm mb-1">Greeting</p>
        <p className="italic text-sm mb-3">"Hi [Name], it is the sales agent calling from Buy‑a‑Warranty. How are you today?"</p>
        <p className="font-semibold text-sm mb-1">Purpose of call</p>
        <p className="italic text-sm mb-3">"Just a quick call regarding your [Make Model / Registration]. You made an enquiry online and I wanted to run through a couple of options with you."</p>
        <p className="font-semibold text-sm mb-1">If they sound busy</p>
        <p className="italic text-sm">"No problem at all. I will keep this very quick."</p>
      </>
    ),
  },
  {
    id: 'confirming',
    title: '2. Confirming details',
    content: (
      <>
        <p className="italic text-sm mb-3">"Just to confirm, you are still looking at warranty options for the [Make Model / Registration], correct?"</p>
        <p className="font-semibold text-sm mb-1">If they have not bought the car yet:</p>
        <p className="italic text-sm">"No worries at all. When are you planning to view it? I can call you the day after to run through the best options."</p>
      </>
    ),
  },
  {
    id: 'budget',
    title: '3. Budget discovery (always ask early)',
    content: (
      <>
        <p className="italic text-sm mb-3">"Did you have a rough budget in mind for what you were hoping to pay monthly?"</p>
        <p className="text-sm text-muted-foreground">This sets boundaries and avoids offering something too high or too low.</p>
      </>
    ),
  },
  {
    id: 'value',
    title: '4. Value summary (use short, clear benefits)',
    content: (
      <>
        <p className="text-sm mb-2 font-medium">Always explain the value before the price. Use this structure:</p>
        <div className="bg-muted/50 rounded-md p-3 mb-3">
          <p className="italic text-sm mb-2">"You are covered for:</p>
          <ul className="list-disc list-inside text-sm space-y-1 ml-2 italic">
            <li>Full mechanical and electrical protection</li>
            <li>Parts and labour</li>
            <li>VAT included</li>
            <li>Any VAT registered garage nationwide</li>
            <li>Optional breakdown cover</li>
            <li>Flexible excess options</li>
            <li>Claim limits up to the value of the car on higher tiers"</li>
          </ul>
        </div>
        <p className="text-sm font-medium mb-1">Only then give the price.</p>
        <p className="italic text-sm">"That option works out at around £[x] per month."</p>
      </>
    ),
  },
  {
    id: 'anchors',
    title: '5. Common value anchors (use during objections)',
    content: (
      <>
        <p className="text-sm mb-2">If they hesitate, use one of these quick reality anchors:</p>
        <div className="space-y-2">
          <p className="italic text-sm border-l-2 border-primary pl-3">"Prevention is always better than cure."</p>
          <p className="italic text-sm border-l-2 border-primary pl-3">"Modern cars are extremely expensive to repair. Even a small electrical fault can cost several hundred pounds."</p>
          <p className="italic text-sm border-l-2 border-primary pl-3">"For this model, the typical repair is £[known amount if applicable], so the policy offers real protection."</p>
        </div>
      </>
    ),
  },
  {
    id: 'objections',
    title: '6. Quick objection handling',
    content: (
      <div className="space-y-4">
        {[
          { q: '"It is too expensive."', a: '"I completely understand. Let me see if I can adjust the excess or labour rate to bring that down for you."' },
          { q: '"My mate is a mechanic."', a: '"That is ideal for labour. The expensive part is the parts themselves. The policy covers those completely."' },
          { q: '"I am busy."', a: '"Absolutely no problem. When is a better time for me to give you a quick call?"' },
          { q: '"I will think about it."', a: '"No problem. I will send the quote now and give you a call on [specific day] so you have time to look it over."' },
        ].map((item, i) => (
          <div key={i} className="bg-muted/50 rounded-md p-3">
            <p className="text-sm font-semibold text-destructive mb-1">Customer: {item.q}</p>
            <p className="text-sm italic ml-3">You: {item.a}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'covered',
    title: '6a. What\'s covered, what\'s not covered',
    content: (
      <div className="space-y-3">
        <p className="italic text-sm">"Your warranty is designed to protect you if something major goes wrong with the car. The sort of fault that can suddenly cost hundreds or even thousands to put right. That is exactly what this cover is here for."</p>
        <p className="italic text-sm">"The only things not included are the normal wear‑and‑tear items every car goes through. Things like brake pads, tyres, bulbs, filters and routine servicing. Those fall under standard maintenance for any vehicle."</p>
        <p className="italic text-sm">"If a serious mechanical or electrical component fails, you are covered. It means you have cover in place for those bigger repair costs."</p>
        <p className="italic text-sm font-medium bg-muted/50 rounded-md p-3">"So in simple terms, this warranty takes care of the expensive problems, while the everyday running costs stay the same as with any car."</p>
      </div>
    ),
  },
  {
    id: 'competitors',
    title: '6b. Speaking about competitors',
    content: (
      <div className="space-y-3">
        <p className="italic text-sm">"To give you a clear picture, warranty companies can vary quite a bit in what they include."</p>
        <p className="italic text-sm">"What we focus on is keeping things straightforward and comprehensive."</p>
        <p className="italic text-sm">"With our cover, all parts and labour are included as standard, so there are no hidden extras, no unexpected bills, and no awkward exclusions that only come up later."</p>
        <p className="italic text-sm">"Some other providers may ask you to contribute towards the cost of repairs, including paying a percentage of the cost of certain parts. With us, everything you need is covered upfront, giving you complete peace of mind."</p>
        <p className="italic text-sm">"Our service team is known for being quick, friendly, and easy to deal with."</p>
        <p className="italic text-sm font-medium bg-muted/50 rounded-md p-3">"If anything goes wrong, you can choose your own VAT registered garage, or we can recommend one for you."</p>
      </div>
    ),
  },
  {
    id: 'incentives',
    title: '7. Incentives that close deals',
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-2">Use only when appropriate.</p>
        <ul className="list-disc list-inside text-sm space-y-1 mb-3">
          <li>Free breakdown cover</li>
          <li>Extra months free</li>
          <li>Higher labour rate added</li>
          <li>Lowered excess</li>
          <li>Extra discount if paid in full (10 percent)</li>
          <li>Upgraded claim limit</li>
        </ul>
        <p className="font-semibold text-sm mb-1">Closing line:</p>
        <p className="italic text-sm">"If I can get this to £[x] with the upgraded labour rate and free breakdown, would you like me to get everything set up for you now?"</p>
      </>
    ),
  },
  {
    id: 'declaration',
    title: '7b. Informal declaration',
    content: (
      <>
        <div className="bg-primary/10 border border-primary/20 rounded-md p-3 mb-4">
          <p className="font-bold text-sm mb-2">🎯 The golden rule</p>
          <p className="text-sm mb-1">Never say:</p>
          <ul className="text-sm text-destructive space-y-0.5 mb-2 ml-2">
            <li>❌ "We won't pay if…"</li>
            <li>❌ "You must declare…"</li>
            <li>❌ "Your claim will be rejected…"</li>
          </ul>
        </div>
        <p className="text-sm font-medium mb-2">After explaining the benefits, say:</p>
        <div className="space-y-2 mb-3">
          <p className="italic text-sm">"Just so you know how the cover works — it's designed for unexpected mechanical or electrical failures that happen after your policy starts."</p>
          <p className="italic text-sm">"It wouldn't cover anything that's already present or any warning lights showing before today."</p>
          <p className="italic text-sm font-semibold">"Is everything running normally with the vehicle at the moment?"</p>
        </div>
        <p className="text-sm text-muted-foreground">Then pause. Let them answer.</p>
      </>
    ),
  },
  {
    id: 'payment',
    title: '8. Payment process script',
    content: (
      <>
        <p className="italic text-sm mb-3">"Perfect. I just need to confirm a few details…"</p>
        <ul className="list-disc list-inside text-sm space-y-0.5 mb-3 ml-2">
          <li>Registration</li>
          <li>Mileage</li>
          <li>Email</li>
          <li>Address</li>
          <li>Start date</li>
        </ul>
        <p className="text-sm font-medium mb-1">Then:</p>
        <p className="italic text-sm mb-3">"Whenever you are ready, can you read out the long card number please?"</p>
        <p className="text-sm font-medium mb-1">Once processed:</p>
        <p className="italic text-sm">"That has gone through successfully. You will receive the documents by email shortly."</p>
      </>
    ),
  },
  {
    id: 'ending',
    title: '9. Ending the call',
    content: (
      <p className="italic text-sm">"Thank you for choosing us. If you need anything at all you have my direct email. Have a lovely day."</p>
    ),
  },
  {
    id: 'flowmap',
    title: '10. Quick call flow (1‑page memory map)',
    content: (
      <ol className="list-decimal list-inside text-sm space-y-1.5">
        <li>Greet and create rapport.</li>
        <li>Explain purpose of call.</li>
        <li>Confirm they still need the warranty.</li>
        <li>Ask for their monthly budget.</li>
        <li>Explain value in simple terms.</li>
        <li>Present the price clearly.</li>
        <li>Handle objections calmly.</li>
        <li>Add a meaningful incentive.</li>
        <li>Ask for the sale.</li>
        <li>Process payment and close warmly.</li>
      </ol>
    ),
  },
];

const generatePrintHtml = () => `
<!DOCTYPE html>
<html><head><title>Buy a Warranty - Sales Cheat Sheet</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 14px; color: #666; margin-bottom: 16px; font-weight: 400; }
  .section { margin-bottom: 14px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; page-break-inside: avoid; }
  .section-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: #0f172a; border-bottom: 2px solid #f97316; padding-bottom: 4px; }
  .line { font-style: italic; margin-bottom: 6px; }
  .label { font-weight: 600; margin-bottom: 2px; }
  .muted { color: #6b7280; }
  .highlight { background: #fff7ed; border-left: 3px solid #f97316; padding: 6px 10px; margin: 6px 0; border-radius: 0 6px 6px 0; }
  ul, ol { margin-left: 18px; }
  li { margin-bottom: 3px; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>Buy‑a‑Warranty — Sales cheat sheet</h1>
<h2>High‑converting quick reference guide</h2>
${SECTIONS.map(s => `<div class="section"><div class="section-title">${s.title}</div><div style="font-size:13px;">[See printed version]</div></div>`).join('')}
</body></html>`;

const generateTextContent = () => {
  let text = 'BUY-A-WARRANTY — SALES EXECUTIVE DESK CHEAT SHEET\nHigh-Converting Quick Reference Guide\n';
  text += '='.repeat(55) + '\n\n';

  const plainSections = [
    { title: '1. OPENING LINES (RAPPORT IN 10 SECONDS)', body: 'Greeting:\n  "Hi [Name], it is the sales agent calling from Buy-a-Warranty. How are you today?"\n\nPurpose of call:\n  "Just a quick call regarding your [Make Model / Registration]. You made an enquiry online and I wanted to run through a couple of options with you."\n\nIf they sound busy:\n  "No problem at all. I will keep this very quick."' },
    { title: '2. CONFIRMING DETAILS', body: '  "Just to confirm, you are still looking at warranty options for the [Make Model / Registration], correct?"\n\nIf they have not bought the car yet:\n  "No worries at all. When are you planning to view it? I can call you the day after to run through the best options."' },
    { title: '3. BUDGET DISCOVERY (ALWAYS ASK EARLY)', body: '  "Did you have a rough budget in mind for what you were hoping to pay monthly?"\n\n  This sets boundaries and avoids offering something too high or too low.' },
    { title: '4. VALUE SUMMARY', body: '  "You are covered for:\n  • Full mechanical and electrical protection\n  • Parts and labour\n  • VAT included\n  • Any VAT registered garage nationwide\n  • Optional breakdown cover\n  • Flexible excess options\n  • Claim limits up to the value of the car on higher tiers"\n\n  Only then give the price:\n  "That option works out at around £[x] per month."' },
    { title: '5. COMMON VALUE ANCHORS', body: '  "Prevention is always better than cure."\n  "Modern cars are extremely expensive to repair. Even a small electrical fault can cost several hundred pounds."\n  "For this model, the typical repair is £[known amount], so the policy offers real protection."' },
    { title: '6. QUICK OBJECTION HANDLING', body: '  "It is too expensive." → "I completely understand. Let me see if I can adjust the excess or labour rate to bring that down for you."\n\n  "My mate is a mechanic." → "That is ideal for labour. The expensive part is the parts themselves. The policy covers those completely."\n\n  "I am busy." → "Absolutely no problem. When is a better time for me to give you a quick call?"\n\n  "I will think about it." → "No problem. I will send the quote now and give you a call on [specific day] so you have time to look it over."' },
    { title: '6a. WHAT\'S COVERED, WHAT\'S NOT', body: '  "Your warranty is designed to protect you if something major goes wrong with the car."\n  "The only things not included are the normal wear-and-tear items every car goes through."\n  "If a serious mechanical or electrical component fails, you are covered."\n  "So in simple terms, this warranty takes care of the expensive problems."' },
    { title: '6b. SPEAKING ABOUT COMPETITORS', body: '  "To give you a clear picture, warranty companies can vary quite a bit in what they include."\n  "What we focus on is keeping things straightforward and comprehensive."\n  "With our cover, all parts and labour are included as standard, so there are no hidden extras, no unexpected bills, and no awkward exclusions that only come up later."\n  "Some other providers may ask you to contribute towards the cost of repairs, including paying a percentage of the cost of certain parts. With us, everything you need is covered upfront, giving you complete peace of mind."\n  "Our service team is known for being quick, friendly, and easy to deal with."\n  "If anything goes wrong, you can choose your own VAT registered garage, or we can recommend one for you."' },
    { title: '7. INCENTIVES THAT CLOSE DEALS', body: '  • Free breakdown cover\n  • Extra months free\n  • Higher labour rate added\n  • Lowered excess\n  • Extra discount if paid in full (10%)\n  • Upgraded claim limit\n\n  Closing line:\n  "If I can get this to £[x] with the upgraded labour rate and free breakdown, would you like me to get everything set up for you now?"' },
    { title: '7b. INFORMAL DECLARATION', body: '  THE GOLDEN RULE - Never say:\n  ❌ "We won\'t pay if..."\n  ❌ "You must declare..."\n  ❌ "Your claim will be rejected..."\n\n  Instead say:\n  "Just so you know how the cover works — it\'s designed for unexpected mechanical or electrical failures that happen after your policy starts."\n  "It wouldn\'t cover anything that\'s already present or any warning lights showing before today."\n  "Is everything running normally with the vehicle at the moment?"\n  Then pause. Let them answer.' },
    { title: '8. PAYMENT PROCESS SCRIPT', body: '  "Perfect. I just need to confirm a few details..."\n  • Registration\n  • Mileage\n  • Email\n  • Address\n  • Start date\n\n  "Whenever you are ready, can you read out the long card number please?"\n  "That has gone through successfully. You will receive the documents by email shortly."' },
    { title: '9. ENDING THE CALL', body: '  "Thank you for choosing us. If you need anything at all you have my direct email. Have a lovely day."' },
    { title: '10. QUICK CALL FLOW (1-PAGE MEMORY MAP)', body: '  1. Greet and create rapport.\n  2. Explain purpose of call.\n  3. Confirm they still need the warranty.\n  4. Ask for their monthly budget.\n  5. Explain value in simple terms.\n  6. Present the price clearly.\n  7. Handle objections calmly.\n  8. Add a meaningful incentive.\n  9. Ask for the sale.\n  10. Process payment and close warmly.' },
  ];

  plainSections.forEach(s => {
    text += `${s.title}\n${'-'.repeat(45)}\n${s.body}\n\n`;
  });

  return text;
};

export const SalesScriptCard: React.FC = () => {
  const scriptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Please allow pop-ups to print'); return; }
    printWindow.document.write(generatePrintHtml());
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleDownload = () => {
    const blob = new Blob([generateTextContent()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BuyAWarranty_Sales_Cheat_Sheet.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Sales cheat sheet downloaded');
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Buy‑a‑Warranty</CardTitle>
            <p className="text-sm font-semibold text-foreground mt-0.5">Sales executive desk cheat sheet</p>
            <p className="text-xs text-muted-foreground mt-0.5">High‑converting quick reference guide</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent ref={scriptRef} className="space-y-3">
        {SECTIONS.map((section) => (
          <details key={section.id} open className="group rounded-lg border border-border overflow-hidden">
            <summary className="flex items-center gap-2 cursor-pointer select-none bg-muted/40 px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted/70 transition-colors">
              <span className="text-primary">›</span>
              <span className="border-b-2 border-primary/60 pb-0.5">{section.title}</span>
            </summary>
            <div className="px-4 py-3 text-foreground">
              {section.content}
            </div>
          </details>
        ))}

        <div className="text-center py-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">Updated Feb 2026</Badge>
          <p className="mt-1.5">Every call is a chance to help someone protect their car</p>
        </div>
      </CardContent>
    </Card>
  );
};
