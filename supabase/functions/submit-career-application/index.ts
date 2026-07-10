import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().min(1).max(120),
  fileBase64: z.string().min(1).max(15_000_000), // ~11MB decoded
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      console.error('Missing keys', { hasResend: !!RESEND_API_KEY, hasLovable: !!LOVABLE_API_KEY });
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { name, email, phone, note, fileName, fileType, fileBase64 } = parsed.data;

    const allowed = ['pdf', 'doc', 'docx', 'rtf', 'txt', 'odt'];
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type. Please upload PDF, DOC, DOCX, RTF, ODT or TXT.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeName = name.replace(/[<>]/g, '');
    const safeEmail = (email || '').replace(/[<>\r\n]/g, '');
    const safePhone = (phone || '').replace(/[<>\r\n]/g, '');
    const safeNote = (note || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

    const html = `
      <h2>New Careers Application</h2>
      <p><strong>Role:</strong> Vehicle Warranty Sales Executive</p>
      <p><strong>Name:</strong> ${safeName}</p>
      ${safeEmail ? `<p><strong>Email:</strong> ${safeEmail}</p>` : ''}
      ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
      ${safeNote ? `<p><strong>Note:</strong><br>${safeNote}</p>` : ''}
      <p><strong>CV:</strong> attached (${fileName})</p>
    `;

    const resendRes = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Buyawarranty Careers <careers@buyawarranty.co.uk>',
        to: ['info@buyawarranty.co.uk'],
        reply_to: safeEmail || undefined,
        subject: `Careers Application – ${safeName}`,
        html,
        attachments: [
          {
            filename: fileName,
            content: fileBase64,
            content_type: fileType || 'application/octet-stream',
          },
        ],
      }),
    });
      const errText = await resendRes.text();
      console.error(`Resend failed [${resendRes.status}]: ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to send application', details: errText }), {
        status: resendRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('submit-career-application error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
