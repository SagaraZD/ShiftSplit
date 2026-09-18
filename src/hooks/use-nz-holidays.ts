import { useEffect, useState } from 'react';

import { getNZPublicHolidays, type PublicHoliday } from '@/services/holiday-service';

export function useNZHolidays(year: number) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);

  useEffect(() => {
    let cancelled = false;
    getNZPublicHolidays(year).then((result) => {
      if (!cancelled) setHolidays(result);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return holidays;
}
