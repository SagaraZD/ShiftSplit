// Runs every Friday (see the pg_cron job in schema.sql) to email every user
// their hours-worked summary for the current week (Monday through today).
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected by Supabase for every Edge Function.
//   RESEND_API_KEY                           — set manually: `supabase secrets set RESEND_API_KEY=re_xxx`.
//   WEEKLY_SUMMARY_FROM_EMAIL                — optional, defaults to Resend's shared test sender.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('WEEKLY_SUMMARY_FROM_EMAIL') ?? 'ShiftSplit <onboarding@resend.dev>';

const WEEKLY_TARGET_MINUTES = 40 * 60;

interface WeeklySummaryRow {
  location_id: string;
  location_name: string;
  color_code: string;
  total_minutes: number;
  week_total_minutes: number;
  target_minutes: number;
  percent_of_location: number | null;
  percent_of_target: number | null;
  overtime_minutes: number;
}

function getCurrentWeekStartISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildEmailHtml(displayName: string, rows: WeeklySummaryRow[], weekStartISO: string): string {
  const weekTotal = rows[0]?.week_total_minutes ?? 0;
  const pct = Math.round((weekTotal / WEEKLY_TARGET_MINUTES) * 100);
  const overtime = Math.max(0, weekTotal - WEEKLY_TARGET_MINUTES);

  const rowsHtml = rows
    .filter((r) => r.total_minutes > 0)
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.color_code};margin-right:8px;"></span>
          <span style="color:#111827;font-size:14px;">${r.location_name}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-size:14px;">
          ${formatMinutes(r.total_minutes)} · ${r.percent_of_location ?? 0}%
        </td>
      </tr>`
    )
    .join('');

  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#111827;margin-bottom:4px;">Your week at ShiftSplit</h2>
    <p style="color:#6b7280;margin-top:0;">Hi ${displayName}, here's your summary for the week starting ${weekStartISO}.</p>
    <div style="background:#f9fafb;border-radius:16px;padding:20px;margin:16px 0;">
      <div style="font-size:30px;font-weight:700;color:#111827;">${formatMinutes(weekTotal)}</div>
      <div style="color:#6b7280;font-size:14px;">${pct}% of your 40h target</div>
      ${overtime > 0 ? `<div style="color:#059669;font-size:14px;margin-top:4px;">+${formatMinutes(overtime)} overtime</div>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Sent automatically every Friday by ShiftSplit.</p>
  </div>`;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const weekStartISO = getCurrentWeekStartISO();

  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500 });
  }

  const results: Array<{ email: string; sent: boolean; error?: string }> = [];

  for (const user of usersPage.users) {
    if (!user.email) continue;

    const { data: rows, error: summaryError } = await supabase.rpc('get_weekly_summary', {
      p_user_id: user.id,
      p_start_date: weekStartISO,
    });

    if (summaryError || !rows) {
      results.push({ email: user.email, sent: false, error: summaryError?.message ?? 'no summary rows' });
      continue;
    }

    const displayName = (user.user_metadata as { display_name?: string } | null)?.display_name || user.email;
    const html = buildEmailHtml(displayName, rows as WeeklySummaryRow[], weekStartISO);

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject: `Your ShiftSplit summary — week of ${weekStartISO}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      results.push({ email: user.email, sent: false, error: await emailRes.text() });
    } else {
      results.push({ email: user.email, sent: true });
    }
  }

  return new Response(JSON.stringify({ weekStartISO, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
