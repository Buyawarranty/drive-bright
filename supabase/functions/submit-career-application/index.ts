import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { CAREERS_FROM, acknowledgementEmail } from '../_shared/careerEmails.ts';

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
  role: z.string().trim().max(160).optional().or(z.literal('')),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().min(1).max(120),
  fileBase64: z.string().min(1).max(15_000_000), // ~11MB decoded
});

const DEFAULT_ROLE = 'Vehicle Warranty Sales Executive';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY');
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
    const { name, email, phone, note, role, fileName, fileType, fileBase64 } = parsed.data;
    const roleApplied = (role || '').trim() || DEFAULT_ROLE;

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ---- Store the CV in the private bucket ---------------------------------
    let cvPath: string | null = null;
    try {
      const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'applicant';
      cvPath = `${stamp}/${slug}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('career-cvs')
        .upload(cvPath, bytes, { contentType: fileType || 'application/octet-stream', upsert: false });
      if (upErr) {
        console.error('CV upload failed', upErr);
        cvPath = null;
      }
    } catch (e) {
      console.error('CV decode/upload error', e);
      cvPath = null;
    }

    // ---- Record the application (starts the 5-working-day clock) ------------
    const { data: inserted, error: insErr } = await supabase
      .from('career_applications')
      .insert({
        full_name: safeName,
        email: safeEmail || null,
        phone: safePhone || null,
        role_applied: roleApplied,
        covering_note: note || null,
        cv_file_name: fileName,
        cv_storage_path: cvPath,
      })
      .select('id, rejection_due_at')
      .single();

    if (insErr) console.error('Could not record career application', insErr);

    // ---- Notify the team ---------------------------------------------------
    const dueText = inserted?.rejection_due_at
      ? new Date(inserted.rejection_due_at).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
        })
      : 'in 5 working days';

    const html = `
      <h2>New Careers Application</h2>
      <p><strong>Role:</strong> ${roleApplied}</p>
      <p><strong>Name:</strong> ${safeName}</p>
      ${safeEmail ? `<p><strong>Email:</strong> ${safeEmail}</p>` : ''}
      ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
      ${safeNote ? `<p><strong>Note:</strong><br>${safeNote}</p>` : ''}
      <p><strong>CV:</strong> attached (${fileName})</p>
      <hr>
      <p style="color:#b91c1c;"><strong>Automatic rejection due ${dueText}.</strong><br>
      Shortlist this applicant in Admin &rarr; Careers Applications before then if you want to speak to them.</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: CAREERS_FROM,
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

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error(`Resend failed [${resendRes.status}]: ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to send application', details: errText }), {
        status: resendRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Acknowledge to the applicant --------------------------------------
    if (safeEmail) {
      try {
        const ack = acknowledgementEmail(safeName, roleApplied);
        const ackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: CAREERS_FROM,
            to: [safeEmail],
            reply_to: 'careers@buyawarranty.co.uk',
            subject: ack.subject,
            html: ack.html,
          }),
        });
        if (ackRes.ok && inserted?.id) {
          await supabase
            .from('career_applications')
            .update({ acknowledgement_sent_at: new Date().toISOString() })
            .eq('id', inserted.id);
        } else if (!ackRes.ok) {
          console.error('Acknowledgement failed', await ackRes.text());
        }
      } catch (e) {
        console.error('Acknowledgement error', e);
      }
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
