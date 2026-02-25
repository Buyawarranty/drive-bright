import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Phone, MessageSquare, Shield, Star, ThumbsUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const SCRIPT_SECTIONS = [
  {
    id: 'opening',
    title: '1. Opening – build rapport',
    icon: Phone,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    lines: [
      '"Good morning/afternoon, this is [Your Name] from Buy a Warranty. Am I speaking with [Customer Name]?"',
      '"Thanks for taking my call. I can see you were looking at cover for your [Vehicle Make/Model] — great choice. I just wanted to make sure you\'ve got all the information you need."',
    ],
    tip: 'Keep it warm and natural. Smile when you speak — they can hear it.',
  },
  {
    id: 'discovery',
    title: '2. Discovery – understand their needs',
    icon: MessageSquare,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    lines: [
      '"How long have you had the car?"',
      '"Have you had any issues with it so far?"',
      '"What made you start looking at warranty cover?"',
      '"Is this your daily driver or a second car?"',
    ],
    tip: 'Listen more than you talk. Their answers tell you exactly which plan to recommend.',
  },
  {
    id: 'present',
    title: '3. Present the plan – match the solution',
    icon: Shield,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    lines: [
      '"Based on what you\'ve told me, our [Gold/Platinum] plan would be perfect. It covers [key components they care about] and includes [relevant add-ons]."',
      '"If anything goes wrong, you call us, we authorise the repair, and the garage gets paid directly. No upfront costs for you."',
      '"You also get breakdown recovery included, so you\'re never stuck at the roadside."',
    ],
    tip: 'Focus on what matters to THEM. A commuter cares about reliability; an enthusiast cares about engine cover.',
  },
  {
    id: 'value',
    title: '4. Build value – make it real',
    icon: Star,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    lines: [
      '"A typical gearbox repair on a [their car] can cost £2,000+. With this plan, that\'s fully covered."',
      '"Think of it as less than a coffee a day for complete peace of mind."',
      '"We\'ve paid out over [£X million] in claims — we\'re here when you need us."',
    ],
    tip: 'Use real repair costs for their specific vehicle. Numbers make it tangible.',
  },
  {
    id: 'objections',
    title: '5. Handle objections – stay confident',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    objections: [
      {
        objection: '"I need to think about it"',
        response: '"Of course — it\'s an important decision. What specifically would you like to think over? I might be able to help with that right now."',
      },
      {
        objection: '"It\'s too expensive"',
        response: '"I understand. But consider this — one repair could cost you more than the entire plan. Would you like me to show you the monthly option? It works out to just [£X] a month."',
      },
      {
        objection: '"I\'ll do it later"',
        response: '"No problem at all. Just so you know, your quote is valid for [X days], and prices can change. I\'d hate for you to miss out on this rate."',
      },
      {
        objection: '"My car is reliable"',
        response: '"That\'s great to hear! But that\'s exactly when cover makes sense — while it\'s running well and before anything unexpected happens. It\'s like insurance: you hope you never need it, but you\'re glad it\'s there."',
      },
    ],
    tip: 'Never argue. Acknowledge, then redirect. Every objection is a question in disguise.',
  },
  {
    id: 'close',
    title: '6. Close – make it easy',
    icon: ThumbsUp,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    lines: [
      '"So, shall we get you covered today? I can have your documents over to you in minutes."',
      '"Would you prefer to pay monthly or save with a one-off payment?"',
      '"I\'ll send everything over by email right now. You\'ll have your policy documents within the hour."',
    ],
    tip: 'Assume the sale. Use "when" not "if". Confidence is contagious.',
  },
  {
    id: 'postclose',
    title: '7. After the sale – secure the relationship',
    icon: CheckCircle2,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    lines: [
      '"Brilliant — you\'re all set! Your policy starts immediately. I\'ll email your documents now."',
      '"If you ever need to make a claim, just call our claims team and they\'ll handle everything."',
      '"One last thing — if you know anyone else who might benefit from cover, we have a referral reward for you."',
    ],
    tip: 'A happy customer is your best lead source. Always mention referrals.',
  },
];

export const SalesScriptCard: React.FC = () => {
  const scriptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = scriptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Buy a Warranty - Sales script</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .subtitle { color: #666; margin-bottom: 20px; font-size: 13px; }
          .section { margin-bottom: 16px; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px; page-break-inside: avoid; }
          .section-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
          .line { background: #f9f9f9; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; font-style: italic; }
          .objection { margin-bottom: 8px; }
          .objection-q { font-weight: 600; color: #c2410c; }
          .objection-a { font-style: italic; margin-left: 12px; margin-top: 2px; }
          .tip { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 6px 10px; margin-top: 8px; font-size: 12px; color: #92400e; }
          @media print { body { padding: 12px; } .section { border-color: #ccc; } }
        </style>
      </head>
      <body>
        <h1>🎯 Buy a Warranty — Sales script</h1>
        <p class="subtitle">Quick reference guide for the sales team</p>
        ${SCRIPT_SECTIONS.map(s => `
          <div class="section">
            <div class="section-title">${s.title}</div>
            ${s.lines ? s.lines.map(l => `<div class="line">${l}</div>`).join('') : ''}
            ${s.objections ? s.objections.map(o => `
              <div class="objection">
                <div class="objection-q">Customer: ${o.objection}</div>
                <div class="objection-a">You: ${o.response}</div>
              </div>
            `).join('') : ''}
            <div class="tip">💡 ${s.tip}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleDownload = () => {
    let text = '🎯 BUY A WARRANTY — SALES SCRIPT\nQuick reference guide for the sales team\n';
    text += '='.repeat(50) + '\n\n';

    SCRIPT_SECTIONS.forEach(s => {
      text += `${s.title.toUpperCase()}\n`;
      text += '-'.repeat(40) + '\n';
      if (s.lines) {
        s.lines.forEach(l => { text += `  ${l}\n\n`; });
      }
      if (s.objections) {
        s.objections.forEach(o => {
          text += `  Customer: ${o.objection}\n`;
          text += `  You: ${o.response}\n\n`;
        });
      }
      text += `  💡 TIP: ${s.tip}\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BuyAWarranty_Sales_Script.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Sales script downloaded');
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              🎯 Sales script
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Quick reference — memorise, print or keep it open while you call
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent ref={scriptRef} className="space-y-4">
        {SCRIPT_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className={`rounded-lg border ${section.borderColor} ${section.bgColor} p-4`}
            >
              <h3 className={`font-bold text-base flex items-center gap-2 mb-3 ${section.color}`}>
                <Icon className="h-5 w-5" />
                {section.title}
              </h3>

              {section.lines && (
                <div className="space-y-2">
                  {section.lines.map((line, i) => (
                    <div key={i} className="bg-white/80 rounded-md px-3 py-2 text-sm italic text-foreground border border-white/60">
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {section.objections && (
                <div className="space-y-3">
                  {section.objections.map((obj, i) => (
                    <div key={i} className="bg-white/80 rounded-md px-3 py-2.5 border border-white/60">
                      <p className="text-sm font-semibold text-orange-700 mb-1">
                        Customer: {obj.objection}
                      </p>
                      <p className="text-sm italic text-foreground ml-3">
                        You: {obj.response}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 bg-amber-50 border-l-3 border-amber-400 rounded-r-md px-3 py-2 text-xs text-amber-800 flex items-start gap-1.5">
                <span>💡</span>
                <span>{section.tip}</span>
              </div>
            </div>
          );
        })}

        <div className="text-center py-4 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">Updated Feb 2026</Badge>
          <p className="mt-2">Remember: every call is a chance to help someone protect their car</p>
        </div>
      </CardContent>
    </Card>
  );
};
