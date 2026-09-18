import { OFFICE_GEOFENCES, WEEKLY_TARGET_MINUTES } from '@/constants/locations';
import type { WorkLogRow } from '@/types/database';

import { addDays, getWeekStart, WEEK_LENGTH_DAYS } from './date-utils';

function isWeekday(date: Date): boolean {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  return day !== 0 && day !== 6;
}

export interface LocationTotal {
  locationId: string;
  name: string;
  color: string;
  minutes: number;
}

export function sumDurationMinutes(logs: WorkLogRow[]): number {
  return logs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
}

export function aggregateByLocation(logs: WorkLogRow[]): LocationTotal[] {
  return OFFICE_GEOFENCES.map((office) => ({
    locationId: office.id,
    name: office.name,
    color: office.color,
    minutes: logs
      .filter((log) => log.location_id === office.id)
      .reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0),
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
    return {
      date,
      byLocation: aggregateByLocation(dayLogs),
      totalMinutes: sumDurationMinutes(dayLogs),
    };
  });
}
