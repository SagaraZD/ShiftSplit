import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/ui/text';
import { BRAND_FONT_FAMILY } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export function SignInScreen() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await signInWithPassword(email.trim(), password);
      } else {
        await signUpWithPassword(email.trim(), password);
        Alert.alert('Check your email', 'Confirm your address to finish creating your account.');
      }
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6">
        <Text
          className="mb-1 text-4xl text-neutral-900 dark:text-white"
          style={{ fontFamily: BRAND_FONT_FAMILY }}>
          ShiftSplit
        </Text>
        <Text className="mb-8 text-base text-neutral-500 dark:text-neutral-400">
          Track your hours across Mangere and Highbrook.
        </Text>

        <View className="gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            className="rounded-2xl bg-neutral-100 px-4 py-3.5 text-base text-neutral-900 dark:bg-neutral-800 dark:text-white"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoComplete="password"
            className="rounded-2xl bg-neutral-100 px-4 py-3.5 text-base text-neutral-900 dark:bg-neutral-800 dark:text-white"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-6 items-center justify-center rounded-2xl bg-indigo-600 py-4 active:opacity-80">
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="mt-4 items-center">
          <Text className="text-sm text-indigo-600 dark:text-indigo-400">
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
