import { Image } from 'expo-image';
import { Camera, LogOut, User, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';
import { type ThemePreference, usePreferences } from '@/providers/preferences-provider';
import { pickAndUploadAvatar } from '@/services/avatar-service';
import { updateProfile } from '@/services/profile-service';
import type { ProfileRow } from '@/types/database';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

interface Props {
  profile: ProfileRow | null;
  onProfileChange: () => Promise<void>;
  onClose: () => void;
}

export function SettingsSheet({ profile, onProfileChange, onClose }: Props) {
  const { session, signOut } = useAuth();
  const { themePreference, setThemePreference, notificationsEnabled, setNotificationsEnabled } = usePreferences();

  const userId = session?.user.id;

  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const hasSeededNameRef = useRef(false);

  // Seed the field once, right when the profile first arrives — never resync
  // automatically after that, so a slow network response can't clobber
  // whatever the user has already started typing.
  useEffect(() => {
    if (!profile || hasSeededNameRef.current) return;
    setDisplayName(profile.display_name ?? '');
    hasSeededNameRef.current = true;
  }, [profile]);

  const nameChanged = displayName.trim() !== (profile?.display_name ?? '') && displayName.trim().length > 0;

  const handleSaveName = async () => {
    if (!userId) return;
    setSavingName(true);
    try {
      await updateProfile(userId, { displayName: displayName.trim() });
      await onProfileChange();
    } catch (err) {
      Alert.alert('Could not save name', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(userId);
      if (url) {
        await updateProfile(userId, { avatarUrl: url });
        await onProfileChange();
      }
    } catch (err) {
      Alert.alert('Could not update photo', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Settings</Text>
        <Pressable onPress={onClose} hitSlop={8} className="rounded-full p-1 active:opacity-60">
          <X size={22} color="#9CA3AF" />
        </Pressable>
      </View>
      <ScrollView contentContainerClassName="gap-6 px-4 py-6">
        <View className="items-center gap-3">
          <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} className="relative">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 96, height: 96 }} contentFit="cover" />
              ) : (
                <User size={40} color="#9CA3AF" />
              )}
            </View>
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-50 bg-indigo-600 dark:border-black">
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">{session?.user.email}</Text>
        </View>

        <View className="gap-3 rounded-3xl bg-white p-5 shadow-sm shadow-black/5 dark:bg-neutral-900">
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            className="rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-800 dark:text-white"
          />
          <Pressable
            onPress={handleSaveName}
            disabled={savingName || !nameChanged}
            className={`items-center rounded-2xl py-3 ${
              nameChanged ? 'bg-indigo-600 active:opacity-80' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}>
            {savingName ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-semibold ${
                  nameChanged ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'
                }`}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View className="gap-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5 dark:bg-neutral-900">
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Preferences</Text>

          <View className="gap-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Appearance</Text>
            <View className="flex-row rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800">
              {THEME_OPTIONS.map((option) => {
                const selected = themePreference === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setThemePreference(option)}
                    className={`flex-1 items-center rounded-xl py-2 ${
                      selected ? 'bg-white dark:bg-neutral-700' : ''
                    }`}>
                    <Text
                      className={`text-sm font-semibold capitalize ${
                        selected ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'
                      }`}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="flex-row items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Notifications</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                Location-based clock-in / clock-out prompts
              </Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="items-center rounded-2xl bg-white py-4 shadow-sm shadow-black/5 active:opacity-70 dark:bg-neutral-900">
          <View className="flex-row items-center gap-2">
            <LogOut size={18} color="#EF4444" />
            <Text className="text-base font-semibold text-red-500">Sign Out</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
