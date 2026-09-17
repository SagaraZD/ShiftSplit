import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { bucketLogsByDay, type DayBucket } from '@/lib/aggregate';
import { addDays } from '@/lib/date-utils';
import { getWorkLogsInRange } from '@/services/work-log-service';

export function useWeekLogs(userId: string | undefined, weekStart: Date) {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const weekEnd = addDays(weekStart, 7);
    const logs = await getWorkLogsInRange(userId, weekStart, weekEnd);
    setDays(bucketLogsByDay(logs, weekStart));
  }, [userId, weekStart]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useRealtimeWorkLogs(userId, refresh);

  return { days, loading, refresh };
}
