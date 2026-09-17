import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/types/database';

export interface ProfileUpdate {
  displayName?: string;
  avatarUrl?: string;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<ProfileRow> {
  const patch: Record<string, string> = {};
  if (update.displayName !== undefined) patch.display_name = update.displayName;
  if (update.avatarUrl !== undefined) patch.avatar_url = update.avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
