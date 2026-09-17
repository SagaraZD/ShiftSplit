import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { getActiveWorkLog } from '@/services/work-log-service';
import type { WorkLogRow } from '@/types/database';

export function useActiveSession(userId: string | undefined) {
  const [activeLog, setActiveLog] = useState<WorkLogRow | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActiveLog(null);
      return;
    }
    const log = await getActiveWorkLog(userId);
    setActiveLog(log);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Realtime keeps this in sync when a session is clocked in/out from a
  // notification action or another device, with no polling required.
  useRealtimeWorkLogs(userId, refresh);

  // Foreground-only UI timer: derives elapsed time from the stored start_time
  // timestamp on each tick rather than accumulating in a background loop.
  useEffect(() => {
    if (!activeLog) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = new Date(activeLog.start_time).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeLog]);

  return { activeLog, elapsedSeconds, loading, refresh };
}
