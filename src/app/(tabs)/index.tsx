import { Image } from 'expo-image';
import { Settings } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

import { ActiveSessionCard } from '@/components/shift/active-session-card';
import { ClockInButtons } from '@/components/shift/clock-in-buttons';
import { LocationBreakdownCard } from '@/components/shift/location-breakdown-card';
import { ProgressRingCard } from '@/components/shift/progress-ring-card';
import { SettingsSheet } from '@/components/settings-sheet';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatWeekRange, getWeekStart } from '@/lib/date-utils';
import { useActiveSession } from '@/hooks/use-active-session';
import { useProfile } from '@/hooks/use-profile';
import { useWeeklySummary } from '@/hooks/use-weekly-summary';
import { useAuth } from '@/providers/auth-provider';
import { clockIn, clockOut } from '@/services/work-log-service';

export default function DashboardScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const weekStart = useMemo(() => getWeekStart(), []);

  const { activeLog, elapsedSeconds, refresh: refreshActive } = useActiveSession(userId);
  const { rows, weekTotalMinutes, targetMinutes, loading, refresh: refreshWeekly } = useWeeklySummary(
    userId,
    weekStart
  );
  const { profile, refresh: refreshProfile } = useProfile(userId);

  const [submittingLocationId, setSubmittingLocationId] = useState<string | null>(null);
  const [clockingOut, setClockingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const locations = rows.map((row) => ({
    locationId: row.location_id,
    name: row.location_name,
    color: row.color_code,
    minutes: row.total_minutes,
  }));

  const handleClockIn = async (locationId: string) => {
    if (!userId) return;
    setSubmittingLocationId(locationId);
    try {
      await clockIn(userId, locationId);
      await Promise.all([refreshActive(), refreshWeekly()]);
    } catch (err) {
      Alert.alert('Could not clock in', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmittingLocationId(null);
    }
  };

  const handleClockOut = async () => {
    if (!userId || !activeLog) return;
    setClockingOut(true);
    try {
      await clockOut(userId, activeLog.id);
      await Promise.all([refreshActive(), refreshWeekly()]);
    } catch (err) {
      Alert.alert('Could not clock out', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setClockingOut(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshActive(), refreshWeekly()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View className="flex-row items-center justify-between px-1 pt-2">
          <Pressable
            onPress={() => setSettingsVisible(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-neutral-200 active:opacity-60 dark:bg-neutral-800">
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 40, height: 40 }} contentFit="cover" />
            ) : (
              <Settings size={20} color="#9CA3AF" />
            )}
          </Pressable>
          <View className="items-end">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white">ShiftSplit</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              {profile?.display_name || session?.user.email}
            </Text>
          </View>
        </View>

        {!loading && <ProgressRingCard locations={locations} targetMinutes={targetMinutes} weekStart={weekStart} />}

        {locations.length > 0 && (
          <LocationBreakdownCard locations={locations} subtitle={formatWeekRange(weekStart)} />
        )}

        {activeLog ? (
          <ActiveSessionCard
            locationId={activeLog.location_id}
            startTime={activeLog.start_time}
            elapsedSeconds={elapsedSeconds}
            onClockOut={handleClockOut}
            submitting={clockingOut}
          />
        ) : (
          <ClockInButtons onClockIn={handleClockIn} submittingLocationId={submittingLocationId} />
        )}
      </ScrollView>

      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsVisible(false)}>
        <SettingsSheet
          profile={profile}
          onProfileChange={refreshProfile}
          onClose={() => setSettingsVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}
