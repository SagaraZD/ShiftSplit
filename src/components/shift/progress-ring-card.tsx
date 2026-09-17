import { PieChart } from 'react-native-gifted-charts';
import { Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { LocationTotal } from '@/lib/aggregate';
import { formatMinutesAsHours, formatWeekRange } from '@/lib/date-utils';

interface Props {
  locations: LocationTotal[];
  targetMinutes: number;
  weekStart: Date;
}

const TRACK_COLOR_LIGHT = '#E5E7EB';
const TRACK_COLOR_DARK = '#404040';

export function ProgressRingCard({ locations, targetMinutes, weekStart }: Props) {
  const scheme = useColorScheme();
  const trackColor = scheme === 'dark' ? TRACK_COLOR_DARK : TRACK_COLOR_LIGHT;

  const totalMinutes = locations.reduce((sum, location) => sum + location.minutes, 0);
  const percent = targetMinutes > 0 ? Math.round((totalMinutes / targetMinutes) * 100) : 0;
  const overtimeMinutes = Math.max(0, totalMinutes - targetMinutes);
  const remainingMinutes = Math.max(0, targetMinutes - totalMinutes);

  const segments = locations
    .filter((location) => location.minutes > 0)
    .map((location) => ({ value: location.minutes, color: location.color }));

  const data =
    segments.length === 0
      ? [{ value: 1, color: trackColor }]
      : remainingMinutes > 0
        ? [...segments, { value: remainingMinutes, color: trackColor }]
        : segments;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      className="items-center rounded-3xl bg-white p-6 shadow-sm shadow-black/5 dark:bg-neutral-900">
      <View className="mb-5 w-full flex-row items-baseline justify-between">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">This Week</Text>
        <Text className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
          {formatWeekRange(weekStart)}
        </Text>
      </View>
      <PieChart
        donut
        radius={92}
        innerRadius={70}
        data={data}
        innerCircleColor="transparent"
        centerLabelComponent={() => (
          <View className="items-center justify-center">
            <Text className="text-3xl font-bold text-neutral-900 dark:text-white">
              {formatMinutesAsHours(totalMinutes)}
            </Text>
            <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {percent}% of {formatMinutesAsHours(targetMinutes)}
            </Text>
          </View>
        )}
      />
      {overtimeMinutes > 0 && (
        <Text className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          +{formatMinutesAsHours(overtimeMinutes)} overtime
        </Text>
      )}
    </Animated.View>
  );
}
