import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { getDailyTargetReachedAt } from '@/lib/aggregate';
import { addDays } from '@/lib/date-utils';
import { cancelDailyTargetAlert, ensureNotificationSetup, scheduleDailyTargetAlert } from '@/services/notification-service';
import { getActiveWorkLog, getWorkLogsInRange } from '@/services/work-log-service';

/**
 * Keeps a single local notification scheduled for the moment the signed-in
 * session takes that day's net time (after lunch) to the daily target — see
 * getDailyTargetReachedAt.
 *
 * The alert is OS-scheduled, so it fires even if the app is closed. It is
 * re-worked out on every work_logs change (sign in/out, edits, other
 * devices), and cancelled when there's no open session, the target has
 * already passed, notifications are turned off, or the user signs out.
 * Native-only: a no-op on web.
 */
export function useDailyTargetAlert(userId: string | undefined, enabled: boolean) {
  const active = enabled && !!userId && Platform.OS !== 'web';
  // Several change events can arrive at once (local write + realtime echo);
  // only the most recent run may schedule or cancel.
  const runSequence = useRef(0);

  const sync = useCallback(async () => {
    if (!active || !userId) return;
    const run = ++runSequence.current;
    try {
      const openLog = await getActiveWorkLog(userId);
      let fireAt: Date | null = null;

      if (openLog) {
        const start = new Date(openLog.start_time);
        const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const dayLogs = await getWorkLogsInRange(userId, dayStart, addDays(dayStart, 1));
        fireAt = getDailyTargetReachedAt(openLog, dayLogs);
      }

      if (run !== runSequence.current) return;
      if (fireAt) {
        await scheduleDailyTargetAlert(fireAt);
      } else {
        await cancelDailyTargetAlert();
      }
    } catch (err) {
      console.warn('[use-daily-target-alert] failed to update the 8-hour alert', err);
    }
  }, [active, userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!active) {
      runSequence.current++;
      cancelDailyTargetAlert().catch(() => {});
      return;
    }
    ensureNotificationSetup().then(sync);
  }, [active, sync]);

  useRealtimeWorkLogs(active ? userId : undefined, sync);
}
