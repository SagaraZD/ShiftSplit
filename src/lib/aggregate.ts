import { DAILY_TARGET_MINUTES, LUNCH_BREAK_MINUTES, OFFICE_GEOFENCES, WEEKLY_TARGET_MINUTES } from '@/constants/locations';
import type { WorkLogRow } from '@/types/database';

import { addDays, getWeekStart, WEEK_LENGTH_DAYS } from './date-utils';

function isWeekday(date: Date): boolean {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  return day !== 0 && day !== 6;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// A single continuous shift and a day split across several clock-ins/outs
// should both lose the same one unpaid lunch break, not one per session —
// so the deduction is worked out once per calendar day, then spread across
// that day's logs in proportion to their share of the day's raw minutes.
// That keeps per-location totals adding back up to the deducted day total.
function netMinutesByLogId(logs: WorkLogRow[]): Map<string, number> {
  const rawByDay = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(new Date(log.start_time));
    rawByDay.set(key, (rawByDay.get(key) ?? 0) + (log.duration_minutes ?? 0));
  }

  const net = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(new Date(log.start_time));
    const rawDayMinutes = rawByDay.get(key) ?? 0;
    const netDayMinutes = Math.max(0, rawDayMinutes - LUNCH_BREAK_MINUTES);
    const ratio = rawDayMinutes > 0 ? netDayMinutes / rawDayMinutes : 0;
    net.set(log.id, (log.duration_minutes ?? 0) * ratio);
  }
  return net;
}

export interface LocationTotal {
  locationId: string;
  name: string;
  color: string;
  minutes: number;
}

export function sumDurationMinutes(logs: WorkLogRow[]): number {
  const net = netMinutesByLogId(logs);
  return logs.reduce((sum, log) => sum + (net.get(log.id) ?? 0), 0);
}

export function aggregateByLocation(logs: WorkLogRow[]): LocationTotal[] {
  const net = netMinutesByLogId(logs);
  return OFFICE_GEOFENCES.map((office) => ({
    locationId: office.id,
    name: office.name,
    color: office.color,
    minutes: logs
      .filter((log) => log.location_id === office.id)
      .reduce((sum, log) => sum + (net.get(log.id) ?? 0), 0),
  }));
}

export interface WeekBucket {
  weekStart: Date;
  totalMinutes: number;
  overtimeMinutes: number;
  byLocation: LocationTotal[];
}

export function bucketLogsByWeek(logs: WorkLogRow[], monthStart: Date, monthEnd: Date): WeekBucket[] {
  const buckets = new Map<number, WorkLogRow[]>();
  for (let cursor = getWeekStart(monthStart); cursor < monthEnd; cursor = addDays(cursor, 7)) {
    buckets.set(cursor.getTime(), []);
  }

  for (const log of logs) {
    const startTime = new Date(log.start_time);
    if (!isWeekday(startTime)) continue; // the work week is Monday–Friday
    const weekKey = getWeekStart(startTime).getTime();
    if (!buckets.has(weekKey)) buckets.set(weekKey, []);
    buckets.get(weekKey)!.push(log);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekStartMs, weekLogs]) => {
      const totalMinutes = sumDurationMinutes(weekLogs);
      return {
        weekStart: new Date(weekStartMs),
        totalMinutes,
        overtimeMinutes: Math.max(0, totalMinutes - WEEKLY_TARGET_MINUTES),
        byLocation: aggregateByLocation(weekLogs),
      };
    });
}

export interface DayBucket {
  date: Date;
  byLocation: LocationTotal[];
  totalMinutes: number;
  overtimeMinutes: number;
}

export function bucketLogsByDay(logs: WorkLogRow[], rangeStart: Date, dayCount = WEEK_LENGTH_DAYS): DayBucket[] {
  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const date = addDays(rangeStart, dayIndex);
    const dayLogs = logs.filter((log) => {
      const started = new Date(log.start_time);
      return (
        started.getFullYear() === date.getFullYear() &&
        started.getMonth() === date.getMonth() &&
        started.getDate() === date.getDate()
      );
    });
    const totalMinutes = sumDurationMinutes(dayLogs);
    return {
      date,
      byLocation: aggregateByLocation(dayLogs),
      totalMinutes,
      overtimeMinutes: Math.max(0, totalMinutes - DAILY_TARGET_MINUTES),
    };
  });
}

/**
 * When the open session takes its day's net time (after the once-a-day lunch
 * deduction) to the daily target: DAILY_TARGET + LUNCH raw minutes, counting
 * the sessions already closed that day. `dayLogs` are all logs that started
 * on the open session's day, the open one included. Returns null if that
 * moment is not after `now`.
 */
export function getDailyTargetReachedAt(openLog: WorkLogRow, dayLogs: WorkLogRow[], now = new Date()): Date | null {
  const closedMinutes = dayLogs
    .filter((log) => log.id !== openLog.id)
    .reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const remainingMinutes = DAILY_TARGET_MINUTES + LUNCH_BREAK_MINUTES - closedMinutes;
  const reachedAt = new Date(new Date(openLog.start_time).getTime() + remainingMinutes * 60_000);
  return reachedAt > now ? reachedAt : null;
}

export interface LiveTotals {
  todayMinutes: number;
  weekMinutes: number;
}

/**
 * Today's and this work week's net totals (after lunch) with the open
 * session counted up to `now`, for the live session card. `weekLogs` are
 * the week's logs from `weekStart`; the open session is swapped in (or
 * added) with its elapsed minutes so the lunch rule treats it like any
 * other log. Weekend logs don't count towards the week, same as elsewhere.
 */
export function getLiveTotals(
  weekLogs: WorkLogRow[],
  openLog: WorkLogRow,
  weekStart: Date,
  now = new Date()
): LiveTotals {
  const elapsedMinutes = Math.max(0, (now.getTime() - new Date(openLog.start_time).getTime()) / 60_000);
  const liveOpenLog = { ...openLog, duration_minutes: elapsedMinutes };
  const logs = [...weekLogs.filter((log) => log.id !== openLog.id && log.end_time), liveOpenLog];

  const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS);
  const inWeek = logs.filter((log) => {
    const started = new Date(log.start_time);
    return started >= weekStart && started < weekEnd && isWeekday(started);
  });
  const today = logs.filter((log) => dayKey(new Date(log.start_time)) === dayKey(now));

  return { todayMinutes: sumDurationMinutes(today), weekMinutes: sumDurationMinutes(inWeek) };
}
