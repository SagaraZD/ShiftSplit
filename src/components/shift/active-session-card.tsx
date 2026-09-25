import { Square } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getOfficeGeofence } from '@/constants/locations';
import type { LiveTotals } from '@/lib/aggregate';
import { formatClockTimestamp, formatElapsed, formatMinutesAsHours } from '@/lib/date-utils';

interface Props {
  locationId: string;
  startTime: string;
  elapsedSeconds: number;
  /** Net of lunch, including this session so far; null while the week is still loading. */
  liveTotals: LiveTotals | null;
  weekTargetMinutes: number;
  onClockOut: () => void;
  onCancel: () => void;
  submitting: boolean;
}

export function ActiveSessionCard({
  locationId,
  startTime,
  elapsedSeconds,
  liveTotals,
  weekTargetMinutes,
  onClockOut,
  onCancel,
  submitting,
}: Props) {
  const office = getOfficeGeofence(locationId);
  const weekRemaining = liveTotals ? weekTargetMinutes - liveTotals.weekMinutes : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      className="gap-4 rounded-3xl p-5 shadow-sm shadow-black/10"
      style={{ backgroundColor: office?.color ?? '#6366F1' }}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-medium text-white/80">Signed in at</Text>
          <Text className="text-xl font-bold text-white">{office?.name ?? 'Unknown office'}</Text>
          <Text className="mt-0.5 text-sm text-white/80">{formatClockTimestamp(new Date(startTime))}</Text>
        </View>
        <View className="h-2.5 w-2.5 rounded-full bg-white" />
      </View>

      <Text className="text-4xl font-bold text-white">{formatElapsed(elapsedSeconds)}</Text>

      <View className="flex-row gap-2">
        <View className="flex-1 rounded-2xl bg-black/15 px-3 py-2.5">
          <Text className="text-xs font-medium text-white/75">Today</Text>
          <Text className="text-lg font-bold text-white">{liveTotals ? formatMinutesAsHours(liveTotals.todayMinutes) : '…'}</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-black/15 px-3 py-2.5">
          <Text className="text-xs font-medium text-white/75">This week</Text>
          <Text className="text-lg font-bold text-white">{liveTotals ? formatMinutesAsHours(liveTotals.weekMinutes) : '…'}</Text>
          <Text className="text-xs text-white/75">
            {!liveTotals
              ? ' '
              : weekRemaining > 0
              ? `${formatMinutesAsHours(weekRemaining)} to ${formatMinutesAsHours(weekTargetMinutes)}`
              : `+${formatMinutesAsHours(-weekRemaining)} over ${formatMinutesAsHours(weekTargetMinutes)}`}
          </Text>
        </View>
      </View>
      <Text className="-mt-2 text-xs text-white/70">Totals include this session, after the 30 min lunch</Text>

      <View className="flex-row gap-2">
        <Pressable
          onPress={onClockOut}
          disabled={submitting}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-black/20 py-3 active:opacity-70">
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Square size={16} color="#fff" fill="#fff" />
          )}
          <Text className="text-base font-semibold text-white">Sign Out</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          disabled={submitting}
          className="items-center justify-center rounded-2xl px-4 py-3 active:opacity-70">
          <Text className="text-sm font-semibold text-white/70">Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
