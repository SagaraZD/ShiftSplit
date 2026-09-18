import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PublicHoliday {
  date: string; // ISO yyyy-mm-dd, using the observed (Mondayised) date
  name: string;
}

// Versioned so a change in source/shape (e.g. switching providers) can never
// collide with and silently serve a stale cache entry from the old shape.
const CACHE_KEY_PREFIX = 'shiftsplit:nz-holidays:v2:';
const API_KEY = process.env.EXPO_PUBLIC_NZ_HOLIDAYS_API_KEY;

interface PublicHolidaysNZResponse {
  HolidayName: string;
  ActualDate: string; // D/M/YYYY
  ObservedDate: string; // D/M/YYYY — Mondayised when ActualDate falls on a weekend
  Type: 'National' | 'Regional';
}

/** "1/01/2026" -> "2026-01-01" */
function parseNZDateToISO(nzDate: string): string {
  const [day, month, year] = nzDate.split('/').map((part) => parseInt(part, 10));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Mangere and Highbrook are both Auckland offices, so only Auckland's regional
 *  anniversary day is relevant — other regions' anniversary days are noise. */
function isRelevant(holiday: PublicHolidaysNZResponse): boolean {
  return holiday.Type === 'National' || holiday.HolidayName.includes('Auckland');
}

/** NZ public holidays for a given year, via the public-holidays.nz API. */
export async function getNZPublicHolidays(year: number): Promise<PublicHoliday[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}${year}`;

  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as PublicHoliday[];
  } catch {
    // Ignore cache read errors — fall through to a network fetch.
  }

  if (!API_KEY) {
    console.warn('[holiday-service] EXPO_PUBLIC_NZ_HOLIDAYS_API_KEY is not set');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.public-holidays.nz/v1/year?apikey=${API_KEY}&year=${year}`
    );
    if (!response.ok) throw new Error(`Holiday API responded with ${response.status}`);

    const data = (await response.json()) as PublicHolidaysNZResponse[];
    const holidays: PublicHoliday[] = data
      .filter(isRelevant)
      .map((holiday) => ({ date: parseNZDateToISO(holiday.ObservedDate), name: holiday.HolidayName }));

    AsyncStorage.setItem(cacheKey, JSON.stringify(holidays)).catch(() => {});
    return holidays;
  } catch (err) {
    console.warn('[holiday-service] failed to fetch NZ public holidays', err instanceof Error ? err.message : err);
    return [];
  }
}
