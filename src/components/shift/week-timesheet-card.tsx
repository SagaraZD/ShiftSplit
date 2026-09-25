import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getOfficeGeofence } from '@/constants/locations';
import { sumDurationMinutes } from '@/lib/aggregate';
import { addDays, formatMinutesAsHours, formatTimeOfDay, isSameDay, WEEK_LENGTH_DAYS } from '@/lib/date-utils';
import type { WorkLogRow } from '@/types/database';

interface Props {
  weekStart: Date;
  logs: WorkLogRow[];
  onSelectDay: (date: Date) => void;
}

/**
 * Every sign-in and sign-out of the week, one row per weekday. The day total
 * is net of lunch and, like everywhere else, only counts completed sessions.
 */
export function WeekTimesheetCard({ weekStart, logs, onSelectDay }: Props) {
  const today = new Date();
  const days = Array.from({ length: WEEK_LENGTH_DAYS }, (_, index) => {
    const date = addDays(weekStart, index);
    const dayLogs = logs
      .filter((log) => isSameDay(new Date(log.start_time), date))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { date, dayLogs, netMinutes: sumDurationMinutes(dayLogs.filter((log) => log.end_time)) };
  });

  return (
    <View className="rounded-3xl bg-white shadow-sm shadow-black/5 dark:bg-neutral-900">
      <View className="px-5 pb-2 pt-5">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Sign-in / Sign-out</Text>
        <Text className="mt-0.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          Day totals are after the 30 min lunch · tap a day to edit
        </Text>
      </View>

      {days.map(({ date, dayLogs, netMinutes }, index) => {
        const isToday = isSameDay(date, today);
        return (
          <Pressable
            key={date.getTime()}
            onPress={() => onSelectDay(date)}
            className={`gap-2 px-5 py-3.5 active:opacity-60 ${
              index < days.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''
            }`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                {isToday && (
                  <Text className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    Today
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  {netMinutes > 0 ? formatMinutesAsHours(netMinutes) : ''}
                </Text>
                <ChevronRight size={16} color="#9CA3AF" />
              </View>
            </View>

            {dayLogs.length === 0 ? (
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">No entries</Text>
            ) : (
              dayLogs.map((log) => {
                const office = getOfficeGeofence(log.location_id);
                return (
                  <View key={log.id} className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: office?.color ?? '#6366F1' }} />
                      <Text className="text-sm text-neutral-800 dark:text-neutral-200">
                        {formatTimeOfDay(new Date(log.start_time))}
                        {' → '}
                        {log.end_time ? (
                          formatTimeOfDay(new Date(log.end_time))
                        ) : (
                          <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Now</Text>
                        )}
                      </Text>
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500">{office?.name ?? 'Unknown'}</Text>
                    </View>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      {log.duration_minutes != null ? formatMinutesAsHours(log.duration_minutes) : 'in progress'}
                    </Text>
                  </View>
                );
              })
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
