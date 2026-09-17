import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { aggregateByLocation, bucketLogsByWeek, sumDurationMinutes, type LocationTotal, type WeekBucket } from '@/lib/aggregate';
import { getMonthEnd } from '@/lib/date-utils';
import { getWorkLogsInRange } from '@/services/work-log-service';

export function useMonthlySummary(userId: string | undefined, monthStart: Date) {
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [byLocation, setByLocation] = useState<LocationTotal[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const monthEnd = getMonthEnd(monthStart);
    const logs = await getWorkLogsInRange(userId, monthStart, monthEnd);
    setWeeks(bucketLogsByWeek(logs, monthStart, monthEnd));
    setByLocation(aggregateByLocation(logs));
    setTotalMinutes(sumDurationMinutes(logs));
  }, [userId, monthStart]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useRealtimeWorkLogs(userId, refresh);

  const overtimeMinutes = weeks.reduce((sum, week) => sum + week.overtimeMinutes, 0);

  return { weeks, byLocation, totalMinutes, overtimeMinutes, loading, refresh };
}
