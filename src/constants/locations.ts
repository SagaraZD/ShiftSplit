// Mirrors the seed rows in schema.sql — keep the IDs in sync with the database.
export const LOCATION_IDS = {
  MANGERE: '00000000-0000-0000-0000-000000000001',
  HIGHBROOK: '00000000-0000-0000-0000-000000000002',
} as const;

export interface OfficeGeofence {
  id: string;
  name: string;
  color: string;
  latitude: number;
  longitude: number;
  radius: number;
}

// Replace lat/lng with your exact office coordinates before shipping.
export const OFFICE_GEOFENCES: OfficeGeofence[] = [
  {
    id: LOCATION_IDS.MANGERE,
    name: 'Mangere',
    color: '#6366F1', // indigo
    latitude: -36.9772,
    longitude: 174.8069,
    radius: 150,
  },
  {
    id: LOCATION_IDS.HIGHBROOK,
    name: 'Highbrook',
    color: '#06B6D4', // cyan
    latitude: -36.9436,
    longitude: 174.9106,
    radius: 150,
  },
];

export const WEEKLY_TARGET_MINUTES = 40 * 60;
export const EXIT_CONFIRMATION_DELAY_MS = 5 * 60 * 1000;

export function getOfficeGeofence(locationId: string): OfficeGeofence | undefined {
  return OFFICE_GEOFENCES.find((office) => office.id === locationId);
}
