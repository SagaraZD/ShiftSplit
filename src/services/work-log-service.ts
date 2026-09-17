import { toISODate } from '@/lib/date-utils';
import { supabase } from '@/lib/supabase';
import type { WeeklySummaryRow, WorkLogRow } from '@/types/database';

export async function getActiveWorkLog(userId: string): Promise<WorkLogRow | null> {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', userId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function clockIn(userId: string, locationId: string): Promise<WorkLogRow> {
  const active = await getActiveWorkLog(userId);
  if (active) {
    throw new Error('Already clocked in. Clock out before starting a new session.');
  }

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ user_id: userId, location_id: locationId, start_time: new Date().toISOString() })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function clockOut(userId: string, workLogId: string): Promise<WorkLogRow> {
  const { data, error } = await supabase
    .from('work_logs')
    .update({ end_time: new Date().toISOString() })
    .eq('id', workLogId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getWeeklySummary(userId: string, weekStart: Date): Promise<WeeklySummaryRow[]> {
  const { data, error } = await supabase.rpc('get_weekly_summary', {
    p_user_id: userId,
    p_start_date: toISODate(weekStart),
  });

  if (error) throw error;
  return data ?? [];
}

export async function getWorkLogsInRange(userId: string, rangeStart: Date, rangeEnd: Date): Promise<WorkLogRow[]> {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', rangeStart.toISOString())
    .lt('start_time', rangeEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
