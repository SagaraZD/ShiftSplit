import { useMemo, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

import { DayEntriesSheet } from '@/components/shift/day-entries-sheet';
import { LocationBreakdownCard } from '@/components/shift/location-breakdown-card';
import { type PeriodMode, PeriodSwitcher } from '@/components/shift/period-switcher';
import { SummaryStatsRow } from '@/components/shift/summary-stats-row';
import { WeeklyBarChart } from '@/components/shift/weekly-bar-chart';
import { WeekListItem } from '@/components/shift/week-list-item';
import { WeekTimesheetCard } from '@/components/shift/week-timesheet-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  addMonths,
  addWeeks,
  formatMonthLabel,
  formatWeekRange,
  getMonthStart,
  getWeekStart,
  isCurrentMonth,
  isSameDay,
  isSameWeek,
} from '@/lib/date-utils';
import { useMonthlySummary } from '@/hooks/use-monthly-summary';
import { useWeekLogs } from '@/hooks/use-week-logs';
import { useWeeklySummary } from '@/hooks/use-weekly-summary';
import { useAuth } from '@/providers/auth-provider';

export default function HistoryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [mode, setMode] = useState<PeriodMode>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [monthStart, setMonthStart] = useState(() => getMonthStart());

  const weekly = useWeeklySummary(userId, weekStart);
  const weekLogs = useWeekLogs(userId, weekStart);
  const monthly = useMonthlySummary(userId, monthStart);

  // The day editor reads straight from this week's logs, which stay current
  // through useWeekLogs' realtime subscription while the sheet is open.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedDayLogs = useMemo(
    () => (selectedDate ? weekLogs.logs.filter((log) => isSameDay(new Date(log.start_time), selectedDate)) : []),
    [weekLogs.logs, selectedDate]
  );

  const weekLocations = weekly.rows.map((row) => ({
    locationId: row.location_id,
    name: row.location_name,
    color: row.color_code,
    minutes: row.total_minutes,
  }));

  const isThisWeek = useMemo(() => isSameWeek(weekStart, new Date()), [weekStart]);
  const isThisMonth = useMemo(() => isCurrentMonth(monthStart), [monthStart]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
        <Text className="px-1 pt-2 text-2xl font-bold text-neutral-900 dark:text-white">History</Text>

        <PeriodSwitcher
          mode={mode}
          onModeChange={setMode}
          label={mode === 'week' ? formatWeekRange(weekStart) : formatMonthLabel(monthStart)}
          onPrev={() =>
            mode === 'week' ? setWeekStart((prev) => addWeeks(prev, -1)) : setMonthStart((prev) => addMonths(prev, -1))
          }
          onNext={() =>
            mode === 'week' ? setWeekStart((prev) => addWeeks(prev, 1)) : setMonthStart((prev) => addMonths(prev, 1))
          }
          nextDisabled={mode === 'week' ? isThisWeek : isThisMonth}
        />

        {mode === 'week' ? (
          <>
            <WeekTimesheetCard weekStart={weekStart} logs={weekLogs.logs} onSelectDay={setSelectedDate} />
            <SummaryStatsRow
              totalMinutes={weekly.weekTotalMinutes}
              overtimeMinutes={weekly.overtimeMinutes}
              locations={weekLocations}
            />
            {weekLocations.length > 0 && (
              <LocationBreakdownCard locations={weekLocations} subtitle={formatWeekRange(weekStart)} />
            )}
            <WeeklyBarChart days={weekLogs.days} />
          </>
        ) : (
          <>
            <SummaryStatsRow
              totalMinutes={monthly.totalMinutes}
              overtimeMinutes={monthly.overtimeMinutes}
              locations={monthly.byLocation}
            />
            {monthly.byLocation.length > 0 && (
              <LocationBreakdownCard
                locations={monthly.byLocation}
                title="Month Breakdown"
                subtitle={formatMonthLabel(monthStart)}
              />
            )}
            <View className="gap-3">
              <Text className="px-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Weekly Breakdown
              </Text>
              {monthly.weeks.map((week, index) => (
                <WeekListItem key={week.weekStart.toISOString()} week={week} index={index} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={selectedDate !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDate(null)}>
        {selectedDate && userId && (
          <DayEntriesSheet
            userId={userId}
            date={selectedDate}
            logs={selectedDayLogs}
            onClose={() => setSelectedDate(null)}
            onChange={weekLogs.refresh}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
