// Called every 15 minutes by the pg_cron job in schema.sql, but only acts on
// NZ Fridays from 8am. Emails a user once per week, on Friday, as soon as their
// net hours for the NZ work week (Mon–Fri, 30 min lunch deducted once per day
// worked) have reached 40h — so someone who passed 40h earlier in the week
// gets it Friday at 8am, and someone who hasn't reached 40h by the end of
// Friday gets nothing. A session still signed in counts up to now. The email
// breaks the week down per office and per day. `weekly_target_emails` records
// who has already been emailed, so each user gets at most one email per week.
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

// Keep in sync with src/constants/locations.ts and get_weekly_summary in schema.sql.
const WEEKLY_TARGET_MINUTES = 40 * 60;
const LUNCH_BREAK_MINUTES = 30;
const NZ_TIME_ZONE = 'Pacific/Auckland';
const FRIDAY = 5;
const EARLIEST_SEND_HOUR = 8; // NZ local time on Friday

interface WorkLog {
  user_id: string;
  location_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
}

interface Location {
  id: string;
  name: string;
  color_code: string;
}

interface DayBreakdown {
  dateKey: string;
  rawMinutes: number;
  lunchMinutes: number;
  netMinutes: number;
  netByLocation: Map<string, number>;
}

interface WeekBreakdown {
  days: DayBreakdown[];
  netMinutes: number;
  netByLocation: Map<string, number>;
}

const nzDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NZ_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** NZ calendar date of an instant, as YYYY-MM-DD. */
function nzDateKey(date: Date): string {
  return nzDateFormatter.format(date);
}

/** NZ day of week (0 = Sun ... 6 = Sat) and hour (0–23) of an instant. */
function nzWeekdayAndHour(date: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NZ_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName), hour };
}

/** Date-only arithmetic on a YYYY-MM-DD key (done in UTC so there's no DST drift). */
function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday–Friday date keys of the NZ work week containing `now`. */
function currentWeekDayKeys(now: Date): string[] {
  const todayKey = nzDateKey(now);
  const dayOfWeek = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 0 = Sun ... 6 = Sat
  const mondayKey = addDaysToKey(todayKey, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  return [0, 1, 2, 3, 4].map((offset) => addDaysToKey(mondayKey, offset));
}

function logMinutes(log: WorkLog, now: Date): number {
  if (log.end_time) return log.duration_minutes ?? 0;
  return Math.max(0, (now.getTime() - new Date(log.start_time).getTime()) / 60_000);
}

/** Same rule as the app and get_weekly_summary: lunch comes off each day's total once, split pro rata across offices. */
function buildWeekBreakdown(logs: WorkLog[], dayKeys: string[], now: Date): WeekBreakdown {
  const rawByDay = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const key = nzDateKey(new Date(log.start_time));
    if (!dayKeys.includes(key)) continue;
    const byLocation = rawByDay.get(key) ?? new Map<string, number>();
    byLocation.set(log.location_id, (byLocation.get(log.location_id) ?? 0) + logMinutes(log, now));
    rawByDay.set(key, byLocation);
  }

  const netByLocation = new Map<string, number>();
  let netMinutes = 0;
  const days = dayKeys.map((dateKey): DayBreakdown => {
    const byLocation = rawByDay.get(dateKey) ?? new Map<string, number>();
    const rawMinutes = [...byLocation.values()].reduce((sum, m) => sum + m, 0);
    const dayNet = Math.max(0, rawMinutes - LUNCH_BREAK_MINUTES);
    const ratio = rawMinutes > 0 ? dayNet / rawMinutes : 0;
    const dayNetByLocation = new Map<string, number>();
    for (const [locationId, minutes] of byLocation) {
      dayNetByLocation.set(locationId, minutes * ratio);
      netByLocation.set(locationId, (netByLocation.get(locationId) ?? 0) + minutes * ratio);
    }
    netMinutes += dayNet;
    return {
      dateKey,
      rawMinutes,
      lunchMinutes: rawMinutes - dayNet,
      netMinutes: dayNet,
      netByLocation: dayNetByLocation,
    };
  });

  return { days, netMinutes, netByLocation };
}

function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-NZ', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(displayName: string, week: WeekBreakdown, locations: Location[], now: Date): string {
  const overtime = Math.max(0, week.netMinutes - WEEKLY_TARGET_MINUTES);
  const asOf = now.toLocaleString('en-NZ', {
    timeZone: NZ_TIME_ZONE,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
  const cell = 'padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;';

  const locationRows = locations
    .filter((location) => (week.netByLocation.get(location.id) ?? 0) > 0)
    .map((location) => {
      const minutes = week.netByLocation.get(location.id) ?? 0;
      const pct = week.netMinutes > 0 ? Math.round((minutes / week.netMinutes) * 100) : 0;
      return `
      <tr>
        <td style="${cell}color:#111827;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${location.color_code};margin-right:8px;"></span>${escapeHtml(location.name)}
        </td>
        <td style="${cell}text-align:right;color:#6b7280;">${formatMinutes(minutes)} · ${pct}%</td>
      </tr>`;
    })
    .join('');

  const dayRows = week.days
    .map((day) => {
      const split = locations
        .filter((location) => (day.netByLocation.get(location.id) ?? 0) > 0)
        .map((location) => `${escapeHtml(location.name)} ${formatMinutes(day.netByLocation.get(location.id) ?? 0)}`)
        .join(' · ');
      return `
      <tr>
        <td style="${cell}color:#111827;">
          ${formatDayLabel(day.dateKey)}
          ${split ? `<div style="color:#9ca3af;font-size:12px;">${split}</div>` : ''}
        </td>
        <td style="${cell}text-align:right;color:#6b7280;">${day.rawMinutes > 0 ? formatMinutes(day.rawMinutes) : '–'}</td>
        <td style="${cell}text-align:right;color:#6b7280;">${day.lunchMinutes > 0 ? `−${formatMinutes(day.lunchMinutes)}` : '–'}</td>
        <td style="${cell}text-align:right;color:#111827;font-weight:600;">${day.netMinutes > 0 ? formatMinutes(day.netMinutes) : '–'}</td>
      </tr>`;
    })
    .join('');

  const headCell = 'padding:6px 0;font-size:12px;color:#9ca3af;font-weight:500;';

  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <h2 style="color:#111827;margin-bottom:4px;">You've reached 40 hours this week</h2>
    <p style="color:#6b7280;margin-top:0;">Hi ${escapeHtml(displayName)}, here's your week so far (as of ${asOf}).</p>
    <div style="background:#f9fafb;border-radius:16px;padding:20px;margin:16px 0;">
      <div style="font-size:30px;font-weight:700;color:#111827;">${formatMinutes(week.netMinutes)}</div>
      <div style="color:#6b7280;font-size:14px;">worked this week, after lunch breaks</div>
      ${overtime > 0 ? `<div style="color:#059669;font-size:14px;margin-top:4px;">+${formatMinutes(overtime)} over the 40h target</div>` : ''}
    </div>

    <h3 style="color:#111827;font-size:15px;margin:24px 0 4px;">By office</h3>
    <table style="width:100%;border-collapse:collapse;">${locationRows}</table>

    <h3 style="color:#111827;font-size:15px;margin:24px 0 4px;">By day</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <th style="${headCell}text-align:left;">Day</th>
        <th style="${headCell}text-align:right;">Worked</th>
        <th style="${headCell}text-align:right;">Lunch</th>
        <th style="${headCell}text-align:right;">Total</th>
      </tr>
      ${dayRows}
    </table>

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Sent by ShiftSplit on Fridays when you've reached 40 hours for the week.</p>
  </div>`;
}

async function fetchLogsSince(supabase: ReturnType<typeof createClient>, since: Date): Promise<WorkLog[]> {
  const pageSize = 1000;
  const logs: WorkLog[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('work_logs')
      .select('user_id, location_id, start_time, end_time, duration_minutes')
      .gte('start_time', since.toISOString())
      .order('start_time', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    logs.push(...((data ?? []) as WorkLog[]));
    if (!data || data.length < pageSize) return logs;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  // Only the cron job (which sends the service role key) may trigger emails.
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const now = new Date();
  const { weekday, hour } = nzWeekdayAndHour(now);
  if (weekday !== FRIDAY || hour < EARLIEST_SEND_HOUR) {
    return json({ skipped: 'emails only go out on NZ Fridays from 8am' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const dayKeys = currentWeekDayKeys(now);
  const weekStart = dayKeys[0];

  try {
    // NZ Monday 00:00 is always less than 8 days back; logs outside the
    // Mon–Fri keys are filtered out in buildWeekBreakdown.
    const logs = await fetchLogsSince(supabase, new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));

    const { data: alreadySent, error: sentError } = await supabase
      .from('weekly_target_emails')
      .select('user_id')
      .eq('week_start', weekStart);
    if (sentError) throw sentError;
    const sentUserIds = new Set((alreadySent ?? []).map((row: { user_id: string }) => row.user_id));

    const logsByUser = new Map<string, WorkLog[]>();
    for (const log of logs) {
      if (sentUserIds.has(log.user_id)) continue;
      logsByUser.set(log.user_id, [...(logsByUser.get(log.user_id) ?? []), log]);
    }

    const { data: locationRows, error: locationsError } = await supabase
      .from('locations')
      .select('id, name, color_code')
      .order('name');
    if (locationsError) throw locationsError;
    const locations = (locationRows ?? []) as Location[];

    const results: Array<{ userId: string; sent: boolean; error?: string }> = [];

    for (const [userId, userLogs] of logsByUser) {
      const week = buildWeekBreakdown(userLogs, dayKeys, now);
      if (week.netMinutes < WEEKLY_TARGET_MINUTES) continue;

      // Claim the week first so overlapping runs can't both send.
      const { data: claimed, error: claimError } = await supabase
        .from('weekly_target_emails')
        .upsert({ user_id: userId, week_start: weekStart }, { onConflict: 'user_id,week_start', ignoreDuplicates: true })
        .select('user_id');
      if (claimError) {
        results.push({ userId, sent: false, error: claimError.message });
        continue;
      }
      if (!claimed || claimed.length === 0) continue;

      const releaseClaim = () =>
        supabase.from('weekly_target_emails').delete().eq('user_id', userId).eq('week_start', weekStart);

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (userError || !email) {
        await releaseClaim();
        results.push({ userId, sent: false, error: userError?.message ?? 'user has no email' });
        continue;
      }

      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
      const displayName = (profile as { display_name: string | null } | null)?.display_name || email;

      // Any failure to send (including a network error) must release the
      // claim, or this user would be marked as emailed and never get it.
      let sendError: string | null = null;
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: `You've reached 40 hours — week of ${formatDayLabel(weekStart)}`,
            html: buildEmailHtml(displayName, week, locations, now),
          }),
        });
        if (!emailRes.ok) sendError = await emailRes.text();
      } catch (err) {
        sendError = err instanceof Error ? err.message : String(err);
      }

      if (sendError) {
        await releaseClaim();
        results.push({ userId, sent: false, error: sendError });
      } else {
        results.push({ userId, sent: true });
      }
    }

    return json({ weekStart, results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
