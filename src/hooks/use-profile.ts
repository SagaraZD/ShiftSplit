import { useCallback, useEffect, useState } from 'react';

import { fetchProfile } from '@/services/profile-service';
import type { ProfileRow } from '@/types/database';

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const row = await fetchProfile(userId);
    setProfile(row);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProfile(userId)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [userId]);

  return { profile, loading, refresh };
}
