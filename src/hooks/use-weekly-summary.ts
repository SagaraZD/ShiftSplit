import { useCallback, useEffect, useState } from 'react';

import { useRealtimeWorkLogs } from '@/hooks/use-realtime-work-logs';
import { getWeeklySummary } from '@/services/work-log-service';
import type { WeeklySummaryRow } from '@/types/database';

export function useWeeklySummary(userId: string | undefined, weekStart: Date) {
  const [rows, setRows] = useState<WeeklySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const summary = await getWeeklySummary(userId, weekStart);
      setRows(summary);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load weekly summary'));
    }
  }, [userId, weekStart]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useRealtimeWorkLogs(userId, refresh);

  const weekTotalMinutes = rows[0]?.week_total_minutes ?? 0;
  const targetMinutes = rows[0]?.target_minutes ?? 2400;
  const overtimeMinutes = rows[0]?.overtime_minutes ?? 0;

  return { rows, weekTotalMinutes, targetMinutes, overtimeMinutes, loading, error, refresh };
}
