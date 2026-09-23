import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { onWorkLogsChanged } from '@/services/work-log-service';

let channelSequence = 0;

/**
 * Subscribes to postgres_changes on work_logs for the given user.
 *
 * Supabase's RealtimeClient reuses an existing channel object when you call
 * `.channel(topic)` with a topic that's already registered, and `removeChannel`
 * only unregisters it after an async `unsubscribe()` round-trip completes. React's
 * effect double-invoke in development (mount -> cleanup -> mount again,
 * synchronously) runs the cleanup's `removeChannel` and the next effect's
 * `.channel(topic)` before that round-trip finishes, so the second effect gets
 * back the same, already-subscribed channel and its `.on(...)` call throws
 * "cannot add postgres_changes callbacks ... after subscribe()". Giving every
 * effect invocation its own unique topic avoids the collision entirely.
 *
 * Realtime alone isn't enough to keep every view current: screens in a
 * background tab can miss events, and the socket drops while the app is
 * backgrounded. So this also refreshes on writes made from this device
 * (`onWorkLogsChanged`) and whenever the app returns to the foreground.
 */
export function useRealtimeWorkLogs(userId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!userId) return;

    const topic = `work-logs-${userId}-${++channelSequence}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_logs', filter: `user_id=eq.${userId}` },
        onChange
      )
      .subscribe();

    const unsubscribeLocal = onWorkLogsChanged(onChange);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onChange();
    });

    return () => {
      supabase.removeChannel(channel);
      unsubscribeLocal();
      appStateSubscription.remove();
    };
  }, [userId, onChange]);
}
