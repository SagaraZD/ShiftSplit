import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

export type PeriodMode = 'week' | 'month';

interface Props {
  mode: PeriodMode;
  onModeChange: (mode: PeriodMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}

export function PeriodSwitcher({ mode, onModeChange, label, onPrev, onNext, nextDisabled }: Props) {
  return (
    <View className="gap-3">
      <View className="flex-row rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800">
        {(['week', 'month'] as const).map((option) => {
          const selected = mode === option;
          return (
            <Pressable
              key={option}
              onPress={() => onModeChange(option)}
              className={`flex-1 items-center rounded-xl py-2 ${selected ? 'bg-white dark:bg-neutral-700' : ''}`}>
              <Text
                className={`text-sm font-semibold capitalize ${
                  selected ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'
                }`}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row items-center justify-between rounded-full border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        <Pressable onPress={onPrev} hitSlop={8} className="rounded-full p-1.5 active:opacity-60">
          <ChevronLeft size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</Text>
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          hitSlop={8}
          className="rounded-full p-1.5 active:opacity-60"
          style={{ opacity: nextDisabled ? 0.3 : 1 }}>
          <ChevronRight size={18} color="#6B7280" />
        </Pressable>
      </View>
    </View>
  );
}
