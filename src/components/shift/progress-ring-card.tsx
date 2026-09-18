import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, useColorScheme, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/text';
import type { LocationTotal } from '@/lib/aggregate';
import { formatMinutesAsHours, formatWeekRange } from '@/lib/date-utils';

interface Props {
  locations: LocationTotal[];
  targetMinutes: number;
  weekStart: Date;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  canGoToNextWeek: boolean;
  isRefreshing: boolean;
  /** Which direction the week just moved, so the content slides the right way. */
  direction: 'previous' | 'next';
}

const TRACK_COLOR_LIGHT = '#E5E7EB';
const TRACK_COLOR_DARK = '#404040';
// Minimum horizontal drag (in px) before a swipe counts as a week change,
// so it doesn't trigger on small accidental touches.
const SWIPE_THRESHOLD = 40;
const SLIDE_DURATION = 220;
// Reserves enough room for the tallest possible content (two location rows,
// overtime line, wrapped legend) so the card never resizes between weeks —
// a resize while sliding is what read as "bouncing".
const CONTENT_MIN_HEIGHT = 310;

export function ProgressRingCard({
  locations,
  targetMinutes,
  weekStart,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  canGoToNextWeek,
  isRefreshing,
  direction,
}: Props) {
  const scheme = useColorScheme();
  const trackColor = scheme === 'dark' ? TRACK_COLOR_DARK : TRACK_COLOR_LIGHT;

  const swipeGesture = Gesture.Pan()
    // Only claim the gesture once the drag is clearly horizontal, so the
    // surrounding ScrollView keeps handling vertical scrolling normally.
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX <= -SWIPE_THRESHOLD) {
        if (canGoToNextWeek) scheduleOnRN(onNextWeek);
      } else if (event.translationX >= SWIPE_THRESHOLD) {
        scheduleOnRN(onPreviousWeek);
      }
    });

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

  // Moving to the next week slides the new content in from the right (old
  // content exits to the left), and vice versa for the previous week — the
  // same convention as a horizontal carousel.
  const entering = direction === 'next' ? SlideInRight.duration(SLIDE_DURATION) : SlideInLeft.duration(SLIDE_DURATION);
  const exiting = direction === 'next' ? SlideOutLeft.duration(SLIDE_DURATION) : SlideOutRight.duration(SLIDE_DURATION);

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        entering={FadeIn.duration(400)}
        className="overflow-hidden rounded-3xl bg-white p-6 shadow-sm shadow-black/5 dark:bg-neutral-900">
        <Pressable
          onPress={onPreviousWeek}
          hitSlop={8}
          className="absolute left-2 top-1/2 z-10 -mt-4 h-8 w-8 items-center justify-center rounded-full bg-neutral-100 active:opacity-70 dark:bg-neutral-800">
          <ChevronLeft size={16} color="#6B7280" />
        </Pressable>
        {canGoToNextWeek && (
          <Pressable
            onPress={onNextWeek}
            hitSlop={8}
            className="absolute right-2 top-1/2 z-10 -mt-4 h-8 w-8 items-center justify-center rounded-full bg-neutral-100 active:opacity-70 dark:bg-neutral-800">
            <ChevronRight size={16} color="#6B7280" />
          </Pressable>
        )}

        {isRefreshing && (
          <View className="absolute right-4 top-4 z-10">
            <ActivityIndicator size="small" />
          </View>
        )}

        <Animated.View
          key={weekStart.getTime()}
          entering={entering}
          exiting={exiting}
          className="items-center"
          style={{ minHeight: CONTENT_MIN_HEIGHT }}>
          <View className="mb-5 w-full flex-row items-baseline justify-between px-6">
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {isCurrentWeek ? 'This Week' : 'Past Week'}
            </Text>
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
          <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-6">
            {locations
              .filter((location) => location.minutes > 0)
              .map((location) => (
                <View key={location.locationId} className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: location.color }} />
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                    {location.name} · {formatMinutesAsHours(location.minutes)}
                  </Text>
                </View>
              ))}
            {remainingMinutes > 0 && (
              <View className="flex-row items-center gap-1.5">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: trackColor }} />
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  Remaining · {formatMinutesAsHours(remainingMinutes)}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
