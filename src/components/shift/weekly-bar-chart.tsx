import { BarChart } from 'react-native-gifted-charts';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { DayBucket } from '@/lib/aggregate';
import { getWeekdayLabels } from '@/lib/date-utils';

interface Props {
  days: DayBucket[];
}

export function WeeklyBarChart({ days }: Props) {
  const labels = getWeekdayLabels();

  const stackData = days.map((day, index) => ({
    label: labels[index],
    labelTextStyle: { color: '#9CA3AF', fontSize: 11 },
    // gifted-charts reads `stacks[0]` unconditionally, so filtering out
    // zero-minute locations here would crash it on a day with no hours at
    // all — keep every location as a (possibly zero-value) segment instead.
    stacks: day.byLocation.map((location) => ({
      value: Math.round((location.minutes / 60) * 10) / 10,
      color: location.color,
    })),
  }));

  const maxHours = Math.max(8, ...days.map((day) => day.totalMinutes / 60));

  return (
    <View className="rounded-3xl bg-white p-5 shadow-sm shadow-black/5 dark:bg-neutral-900">
      <Text className="mb-4 text-base font-semibold text-neutral-900 dark:text-neutral-100">Daily Hours</Text>
      <BarChart
        stackData={stackData}
        barWidth={22}
        spacing={18}
        roundedTop
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
        noOfSections={4}
        maxValue={Math.ceil(maxHours)}
        height={160}
      />
    </View>
  );
}
