import AsyncStorage from '@react-native-async-storage/async-storage';

import { isWeekend, toISODate } from '@/lib/date-utils';
import { supabase } from '@/lib/supabase';
import { ALLOW_WEEKEND_CLOCK_IN_KEY } from '@/providers/preferences-provider';
import type { WeeklySummaryRow, WorkLogRow } from '@/types/database';

const workLogsChangedListeners = new Set<() => void>();

/**
 * Notifies every mounted data hook, on every tab, that work_logs changed from
 * this device. Realtime events alone aren't reliably delivered to screens
 * sitting in a background tab, so each write below announces itself locally
 * too. Returns an unsubscribe function.
 */
export function onWorkLogsChanged(listener: () => void): () => void {
  workLogsChangedListeners.add(listener);
  return () => {
    workLogsChangedListeners.delete(listener);
  };
}

function notifyWorkLogsChanged() {
  workLogsChangedListeners.forEach((listener) => listener());
}

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

async function assertWeekendSignInAllowed(date: Date): Promise<void> {
  if (!isWeekend(date)) return;
  const allowWeekend = await AsyncStorage.getItem(ALLOW_WEEKEND_CLOCK_IN_KEY);
  if (allowWeekend !== 'true') {
    throw new Error('Weekend sign-in is off. Turn it on in Settings to log time on weekends.');
  }
}

export async function clockIn(userId: string, locationId: string): Promise<WorkLogRow> {
  await assertWeekendSignInAllowed(new Date());

  const active = await getActiveWorkLog(userId);
  if (active) {
    throw new Error('Already signed in. Sign out before starting a new session.');
  }

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ user_id: userId, location_id: locationId, start_time: new Date().toISOString() })
    .select('*')
    .single();

  if (error) throw error;
  notifyWorkLogsChanged();
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
  notifyWorkLogsChanged();
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

/**
 * Manually-added entries usually carry both a start and end time. Passing
 * `endTime: null` instead leaves the entry open — for the "I forgot to sign
 * in" case, where a backdated start time should pick up as the live active
 * session, continuing the elapsed timer from that time. The DB only allows
 * one open (end_time null) row per user, so that case re-checks the same way
 * a live sign-in does.
 */
export async function createManualWorkLog(
  userId: string,
  locationId: string,
  startTime: Date,
  endTime: Date | null
): Promise<WorkLogRow> {
  if (endTime && endTime <= startTime) {
    throw new Error('End time must be after the start time.');
  }

  if (!endTime) {
    if (startTime > new Date()) {
      throw new Error('Start time cannot be in the future.');
    }
    await assertWeekendSignInAllowed(startTime);
    const active = await getActiveWorkLog(userId);
    if (active) {
      throw new Error('Already signed in. Sign out before starting a new open session.');
    }
  }

  const { data, error } = await supabase
    .from('work_logs')
    .insert({
      user_id: userId,
      location_id: locationId,
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
    })
    .select('*')
    .single();

  if (error) throw error;
  notifyWorkLogsChanged();
  return data;
}

export async function updateManualWorkLog(
  userId: string,
  workLogId: string,
  locationId: string,
  startTime: Date,
  endTime: Date | null
): Promise<WorkLogRow> {
  if (endTime && endTime <= startTime) {
    throw new Error('End time must be after the start time.');
  }

  if (!endTime) {
    if (startTime > new Date()) {
      throw new Error('Start time cannot be in the future.');
    }
    await assertWeekendSignInAllowed(startTime);
    const active = await getActiveWorkLog(userId);
    if (active && active.id !== workLogId) {
      throw new Error('Already signed in elsewhere. Sign out before reopening this entry.');
    }
  }

  const { data, error } = await supabase
    .from('work_logs')
    .update({
      location_id: locationId,
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
    })
    .eq('id', workLogId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  notifyWorkLogsChanged();
  return data;
}

export async function deleteWorkLog(userId: string, workLogId: string): Promise<void> {
  const { error } = await supabase.from('work_logs').delete().eq('id', workLogId).eq('user_id', userId);
  if (error) throw error;
  notifyWorkLogsChanged();
}
