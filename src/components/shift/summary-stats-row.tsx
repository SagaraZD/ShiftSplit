import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { LocationTotal } from '@/lib/aggregate';
import { formatMinutesAsHours } from '@/lib/date-utils';

interface Props {
  totalMinutes: number;
  overtimeMinutes: number;
  locations: LocationTotal[];
}

export function SummaryStatsRow({ totalMinutes, overtimeMinutes, locations }: Props) {
  const [first, second] = locations;
  const ratioLabel =
    totalMinutes > 0 && first && second
      ? `${Math.round((first.minutes / totalMinutes) * 100)}% / ${Math.round((second.minutes / totalMinutes) * 100)}%`
      : '—';

  const stats = [
    { label: 'Total Hours', value: formatMinutesAsHours(totalMinutes) },
    { label: 'Overtime', value: overtimeMinutes > 0 ? formatMinutesAsHours(overtimeMinutes) : '0h' },
    { label: `${first?.name ?? ''} / ${second?.name ?? ''}`, value: ratioLabel },
  ];

  return (
    <View className="flex-row gap-3">
      {stats.map((stat) => (
        <View
          key={stat.label}
          className="flex-1 gap-1 rounded-2xl bg-white p-4 shadow-sm shadow-black/5 dark:bg-neutral-900">
          <Text className="text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
            {stat.label}
          </Text>
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">{stat.value}</Text>
        </View>
      ))}
    </View>
  );
}
