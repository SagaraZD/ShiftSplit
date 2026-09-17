import { Square } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { getOfficeGeofence } from '@/constants/locations';
import { formatElapsed } from '@/lib/date-utils';

interface Props {
  locationId: string;
  elapsedSeconds: number;
  onClockOut: () => void;
  submitting: boolean;
}

export function ActiveSessionCard({ locationId, elapsedSeconds, onClockOut, submitting }: Props) {
  const office = getOfficeGeofence(locationId);

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      className="gap-4 rounded-3xl p-5 shadow-sm shadow-black/10"
      style={{ backgroundColor: office?.color ?? '#6366F1' }}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-medium text-white/80">Clocked in at</Text>
          <Text className="text-xl font-bold text-white">{office?.name ?? 'Unknown office'}</Text>
        </View>
        <View className="h-2.5 w-2.5 rounded-full bg-white" />
      </View>

      <Text className="text-4xl font-bold text-white">{formatElapsed(elapsedSeconds)}</Text>

      <Pressable
        onPress={onClockOut}
        disabled={submitting}
        className="flex-row items-center justify-center gap-2 rounded-2xl bg-black/20 py-3 active:opacity-70">
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Square size={16} color="#fff" fill="#fff" />
        )}
        <Text className="text-base font-semibold text-white">Clock Out</Text>
      </Pressable>
    </Animated.View>
  );
}
