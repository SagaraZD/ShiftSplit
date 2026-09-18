import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

import { MonthCalendar } from '@/components/shift/month-calendar';
import { SummaryStatsRow } from '@/components/shift/summary-stats-row';
import { OFFICE_GEOFENCES } from '@/constants/locations';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { addMonths, formatMonthLabel, getMonthStart, isCurrentMonth } from '@/lib/date-utils';
import { useMonthCalendar } from '@/hooks/use-month-calendar';
import { useMonthlySummary } from '@/hooks/use-monthly-summary';
import { useNZHolidays } from '@/hooks/use-nz-holidays';
import { useAuth } from '@/providers/auth-provider';

// Room for the title plus up to 3 holiday rows (the realistic NZ max in one
// month, e.g. Good Friday + Easter Monday + Anzac Day) — rendering the card
// at a constant size, even when empty, stops it from popping in/out and
// resizing while swiping between months.
const PUBLIC_HOLIDAYS_MIN_HEIGHT = 140;

export default function CalendarScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [monthStart, setMonthStart] = useState(() => getMonthStart());
  const [monthSwipeDirection, setMonthSwipeDirection] = useState<'previous' | 'next'>('previous');
  const { days, loading } = useMonthCalendar(userId, monthStart);
  const monthly = useMonthlySummary(userId, monthStart);
  const holidays = useNZHolidays(monthStart.getFullYear());

  // Once the first month has ever loaded, keep the grid mounted during later
  // month changes (with a small spinner) instead of hiding it — hiding it
  // made the summary row above jump every time the month changed.
  const [hasLoadedMonthOnce, setHasLoadedMonthOnce] = useState(false);
  useEffect(() => {
    if (!loading) setHasLoadedMonthOnce(true);
  }, [loading]);

  const monthHolidays = holidays.filter((holiday) => {
    const date = new Date(holiday.date);
    return date.getFullYear() === monthStart.getFullYear() && date.getMonth() === monthStart.getMonth();
  });

  const handlePreviousMonth = () => {
    setMonthSwipeDirection('previous');
    setMonthStart((prev) => addMonths(prev, -1));
  };
  const handleNextMonth = () => {
    setMonthSwipeDirection('next');
    setMonthStart((prev) => addMonths(prev, 1));
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
        <View className="flex-row items-center justify-between px-1 pt-2">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Calendar</Text>
          {!isCurrentMonth(monthStart) && (
            <Pressable
              onPress={() => setMonthStart(getMonthStart())}
              hitSlop={8}
              className="rounded-full bg-indigo-600 px-3 py-1.5 active:opacity-80">
              <Text className="text-xs font-semibold text-white">Today</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center justify-between rounded-full border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
          <Pressable onPress={handlePreviousMonth} hitSlop={8} className="rounded-full p-1.5 active:opacity-60">
            <ChevronLeft size={18} color="#6B7280" />
          </Pressable>
          <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {formatMonthLabel(monthStart)}
          </Text>
          <Pressable onPress={handleNextMonth} hitSlop={8} className="rounded-full p-1.5 active:opacity-60">
            <ChevronRight size={18} color="#6B7280" />
          </Pressable>
        </View>

        <SummaryStatsRow
          totalMinutes={monthly.totalMinutes}
          overtimeMinutes={monthly.overtimeMinutes}
          locations={monthly.byLocation}
        />

        {hasLoadedMonthOnce && (
          <MonthCalendar
            monthStart={monthStart}
            days={days}
            holidays={holidays}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            isRefreshing={loading}
            direction={monthSwipeDirection}
          />
        )}

        <View className="flex-row items-center justify-center gap-5">
          {OFFICE_GEOFENCES.map((office) => (
            <View key={office.id} className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: office.color }} />
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">{office.name}</Text>
            </View>
          ))}
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">NZ Public Holiday</Text>
          </View>
        </View>

        <View
          className="gap-3 rounded-3xl bg-white p-5 shadow-sm shadow-black/5 dark:bg-neutral-900"
          style={{ minHeight: PUBLIC_HOLIDAYS_MIN_HEIGHT }}>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Public Holidays This Month
          </Text>
          {monthHolidays.length > 0 ? (
            monthHolidays.map((holiday) => (
              <View key={holiday.date} className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">{holiday.name}</Text>
                <Text className="text-sm text-neutral-400 dark:text-neutral-500">
                  {new Date(holiday.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-neutral-400 dark:text-neutral-500">No public holidays this month.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
