import { Text, View } from 'react-native';

import type { LocationTotal } from '@/lib/aggregate';
import { formatMinutesAsHours } from '@/lib/date-utils';

interface Props {
  locations: LocationTotal[];
  title?: string;
  subtitle?: string;
}

export function LocationBreakdownCard({ locations, title = 'Location Breakdown', subtitle }: Props) {
  const total = locations.reduce((sum, location) => sum + location.minutes, 0);

  return (
    <View className="rounded-3xl bg-white shadow-sm shadow-black/5 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
        <View>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</Text>
          {subtitle && (
            <Text className="mt-0.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">{subtitle}</Text>
          )}
        </View>
        <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          {formatMinutesAsHours(total)}
        </Text>
      </View>
      {locations.map((location, index) => {
        const pct = total > 0 ? Math.round((location.minutes / total) * 100) : 0;
        return (
          <View
            key={location.locationId}
            className={`gap-2 px-5 py-3.5 ${
              index < locations.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''
            }`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: location.color }} />
                <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{location.name}</Text>
              </View>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                {formatMinutesAsHours(location.minutes)} · {pct}%
              </Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: location.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
