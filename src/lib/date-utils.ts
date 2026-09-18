const DAY_MS = 24 * 60 * 60 * 1000;

/** The work week is Monday–Friday. */
export const WEEK_LENGTH_DAYS = 5;

/** Monday 00:00 of the week containing `date`. */
export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getMonthStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getMonthEnd(monthStart: Date): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export function getWeekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS - 1);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const endLabel = weekEnd.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

export function isSameWeek(a: Date, b: Date): boolean {
  return getWeekStart(a).getTime() === getWeekStart(b).getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday-first weekday index: Monday -> 0 ... Sunday -> 6. */
export function getMondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function isCurrentMonth(monthStart: Date, reference = new Date()): boolean {
  return monthStart.getFullYear() === reference.getFullYear() && monthStart.getMonth() === reference.getMonth();
}

/** e.g. 125 -> "2h 5m" */
export function formatMinutesAsHours(minutes: number): string {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** e.g. Thu 18 Sep, 9:15 am */
export function formatClockTimestamp(date: Date): string {
  const dateLabel = date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = date.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel}, ${timeLabel}`;
}

/** e.g. 3725 -> "01:02:05" */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
