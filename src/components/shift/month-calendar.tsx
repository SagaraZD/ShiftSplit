import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { DayBucket } from '@/lib/aggregate';
import { formatMinutesAsHours, getMondayIndex, isSameDay, toISODate } from '@/lib/date-utils';
import type { PublicHoliday } from '@/services/holiday-service';

interface Props {
  monthStart: Date;
  days: DayBucket[];
  holidays?: PublicHoliday[];
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_CELL_WIDTH = '12%';
const TOTAL_CELL_WIDTH = '16%';

function groupIntoWeeks(monthStart: Date, days: DayBucket[]): (DayBucket | null)[][] {
  const leadingBlanks = getMondayIndex(monthStart);
  const cells: (DayBucket | null)[] = [...Array(leadingBlanks).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayBucket | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function MonthCalendar({ monthStart, days, holidays = [] }: Props) {
  const weeks = groupIntoWeeks(monthStart, days);
  const today = new Date();
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

  return (
    <View className="rounded-3xl bg-white p-4 shadow-sm shadow-black/5 dark:bg-neutral-900">
      <View className="flex-row">
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} style={{ width: DAY_CELL_WIDTH }} className="items-center">
            <Text className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{label}</Text>
          </View>
        ))}
        <View style={{ width: TOTAL_CELL_WIDTH }} className="items-center">
          <Text className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Total</Text>
        </View>
      </View>

      {weeks.map((week, weekIndex) => {
        const weekTotalMinutes = week.reduce((sum, day) => sum + (day?.totalMinutes ?? 0), 0);
        return (
          <View key={weekIndex} className="mt-1 flex-row items-stretch">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <View key={`blank-${dayIndex}`} style={{ width: DAY_CELL_WIDTH }} className="aspect-square p-1" />;
              }

              const worked = day.totalMinutes > 0;
              const locations = day.byLocation.filter((location) => location.minutes > 0);
              const primary = [...locations].sort((a, b) => b.minutes - a.minutes)[0];
              const isToday = isSameDay(day.date, today);
              const isHoliday = holidaysByDate.has(toISODate(day.date));

              return (
                <View key={day.date.toISOString()} style={{ width: DAY_CELL_WIDTH }} className="aspect-square p-1">
                  <View
                    className={`flex-1 items-center justify-center overflow-hidden rounded-xl ${
                      isToday ? 'border-2 border-indigo-500' : ''
                    } ${worked ? '' : 'bg-neutral-50 dark:bg-neutral-800/40'}`}
                    style={worked ? { backgroundColor: `${primary?.color ?? '#6366F1'}1F` } : undefined}>
                    {isHoliday && (
                      <View className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    )}
                    <Text
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : worked
                            ? 'text-neutral-800 dark:text-neutral-200'
                            : 'text-neutral-300 dark:text-neutral-600'
                      }`}>
                      {day.date.getDate()}
                    </Text>
                    {worked && (
                      <Text
                        className="text-[8px] font-medium"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{ color: primary?.color }}>
                        {formatMinutesAsHours(day.totalMinutes)}
                      </Text>
                    )}
                    {locations.length > 1 && (
                      <View className="mt-0.5 h-1 w-6 flex-row overflow-hidden rounded-full">
                        {locations.map((location) => (
                          <View
                            key={location.locationId}
                            style={{
                              width: `${(location.minutes / day.totalMinutes) * 100}%`,
                              backgroundColor: location.color,
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <View style={{ width: TOTAL_CELL_WIDTH }} className="items-center justify-center p-1">
              <Text
                className={`text-xs font-bold ${
                  weekTotalMinutes > 0
                    ? 'text-neutral-700 dark:text-neutral-300'
                    : 'text-neutral-300 dark:text-neutral-600'
                }`}>
                {weekTotalMinutes > 0 ? formatMinutesAsHours(weekTotalMinutes) : '—'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
