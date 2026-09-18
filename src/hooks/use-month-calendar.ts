import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { bucketLogsByDay, type DayBucket } from '@/lib/aggregate';
import { getMonthEnd } from '@/lib/date-utils';
import { getWorkLogsInRange } from '@/services/work-log-service';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useMonthCalendar(userId: string | undefined, monthStart: Date) {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const monthEnd = getMonthEnd(monthStart);
    const dayCount = Math.round((monthEnd.getTime() - monthStart.getTime()) / DAY_MS);
    const logs = await getWorkLogsInRange(userId, monthStart, monthEnd);
    setDays(bucketLogsByDay(logs, monthStart, dayCount));
  }, [userId, monthStart]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useRealtimeWorkLogs(userId, refresh);

  return { days, loading, refresh };
}
