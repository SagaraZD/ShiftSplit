import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/** Opens the photo library, uploads the chosen image to Storage, and returns its public URL. */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to set a profile picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.base64) return null;

  const fileExt = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType = asset.mimeType ?? `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
  const path = `${userId}/avatar-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(asset.base64), { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
