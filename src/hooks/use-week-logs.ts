import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { bucketLogsByDay, type DayBucket } from '@/lib/aggregate';
import { addDays, WEEK_LENGTH_DAYS } from '@/lib/date-utils';
import { getWorkLogsInRange } from '@/services/work-log-service';
import type { WorkLogRow } from '@/types/database';

export function useWeekLogs(userId: string | undefined, weekStart: Date) {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [logs, setLogs] = useState<WorkLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS);
    const weekLogs = await getWorkLogsInRange(userId, weekStart, weekEnd);
    setLogs(weekLogs);
    setDays(bucketLogsByDay(weekLogs, weekStart));
  }, [userId, weekStart]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useRealtimeWorkLogs(userId, refresh);

  return { days, logs, loading, refresh };
}
