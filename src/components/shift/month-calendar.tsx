import { ActivityIndicator, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/text';
import type { DayBucket } from '@/lib/aggregate';
import { formatMinutesAsHours, getMondayIndex, isSameDay, toISODate } from '@/lib/date-utils';
import type { PublicHoliday } from '@/services/holiday-service';

interface Props {
  monthStart: Date;
  days: DayBucket[];
  holidays?: PublicHoliday[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (date: Date) => void;
  isRefreshing: boolean;
  /** Which direction the month just moved, so the content slides the right way. */
  direction: 'previous' | 'next';
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_CELL_WIDTH = '12%';
const TOTAL_CELL_WIDTH = '16%';
// Minimum horizontal drag (in px) before a swipe counts as a month change,
// so it doesn't trigger on small accidental touches.
const SWIPE_THRESHOLD = 40;
const SLIDE_DURATION = 220;

// A Monday-first month grid never needs more than 6 rows (a 31-day month
// starting on a Sunday spills into a 6th row) — always padding out to that
// many rows keeps the grid's height constant across every month, so it
// doesn't resize while swiping between them.
const MAX_WEEK_ROWS = 6;

function groupIntoWeeks(monthStart: Date, days: DayBucket[]): (DayBucket | null)[][] {
  const leadingBlanks = getMondayIndex(monthStart);
  const cells: (DayBucket | null)[] = [...Array(leadingBlanks).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayBucket | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  while (weeks.length < MAX_WEEK_ROWS) {
    weeks.push(Array(7).fill(null));
  }
  return weeks;
}

export function MonthCalendar({
  monthStart,
  days,
  holidays = [],
  onPreviousMonth,
  onNextMonth,
  onSelectDay,
  isRefreshing,
  direction,
}: Props) {
  const weeks = groupIntoWeeks(monthStart, days);
  const today = new Date();
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

  const swipeGesture = Gesture.Pan()
    // Only claim the gesture once the drag is clearly horizontal, so the
    // surrounding ScrollView keeps handling vertical scrolling normally.
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX <= -SWIPE_THRESHOLD) {
        scheduleOnRN(onNextMonth);
      } else if (event.translationX >= SWIPE_THRESHOLD) {
        scheduleOnRN(onPreviousMonth);
      }
    });

  // Moving to the next month slides the new grid in from the right (old
  // grid exits to the left), and vice versa for the previous month.
  const entering = direction === 'next' ? SlideInRight.duration(SLIDE_DURATION) : SlideInLeft.duration(SLIDE_DURATION);
  const exiting = direction === 'next' ? SlideOutLeft.duration(SLIDE_DURATION) : SlideOutRight.duration(SLIDE_DURATION);

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm shadow-black/5 dark:bg-neutral-900">
        {isRefreshing && (
          <View className="absolute right-3 top-3 z-10">
            <ActivityIndicator size="small" />
          </View>
        )}
        <Animated.View key={monthStart.getTime()} entering={entering} exiting={exiting}>
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
                    <Pressable
                      key={day.date.toISOString()}
                      onPress={() => onSelectDay(day.date)}
                      style={{ width: DAY_CELL_WIDTH }}
                      className="aspect-square p-1 active:opacity-70">
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
                    </Pressable>
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
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
