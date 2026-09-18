import { Clock } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { OFFICE_GEOFENCES } from '@/constants/locations';

interface Props {
  onClockIn: (locationId: string) => void;
  submittingLocationId: string | null;
  disabled?: boolean;
  disabledReason?: string;
}

export function ClockInButtons({ onClockIn, submittingLocationId, disabled, disabledReason }: Props) {
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Manual Clock In</Text>
      <View className="flex-row gap-3">
        {OFFICE_GEOFENCES.map((office) => {
          const submitting = submittingLocationId === office.id;
          return (
            <Pressable
              key={office.id}
              onPress={() => onClockIn(office.id)}
              disabled={disabled || submittingLocationId !== null}
              className="flex-1 items-center justify-center gap-2 rounded-2xl py-4 active:opacity-80"
              style={{
                backgroundColor: office.color,
                opacity: disabled ? 0.4 : submittingLocationId && !submitting ? 0.5 : 1,
              }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Clock size={18} color="#fff" />}
              <Text className="text-center text-sm font-semibold text-white">Clock In{'\n'}{office.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {disabled && disabledReason && (
        <Text className="text-xs text-neutral-400 dark:text-neutral-500">{disabledReason}</Text>
      )}
    </View>
  );
}
