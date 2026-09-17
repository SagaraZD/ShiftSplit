import { Text, View } from 'react-native';

import type { WeekBucket } from '@/lib/aggregate';
import { formatMinutesAsHours, formatWeekRange } from '@/lib/date-utils';

interface Props {
  week: WeekBucket;
  index: number;
}

export function WeekListItem({ week, index }: Props) {
  const total = week.totalMinutes;

  return (
    <View className="gap-2 rounded-2xl bg-white p-4 shadow-sm shadow-black/5 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">Week {index + 1}</Text>
          <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {formatWeekRange(week.weekStart)}
          </Text>
        </View>
        <Text className="text-sm font-semibold text-neutral-900 dark:text-white">{formatMinutesAsHours(total)}</Text>
      </View>
      <View className="h-2 flex-row overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {week.byLocation.map((location) => (
          <View
            key={location.locationId}
            style={{
              width: total > 0 ? `${(location.minutes / total) * 100}%` : 0,
              backgroundColor: location.color,
            }}
          />
        ))}
      </View>
      {week.overtimeMinutes > 0 && (
        <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          +{formatMinutesAsHours(week.overtimeMinutes)} overtime
        </Text>
      )}
    </View>
  );
}
