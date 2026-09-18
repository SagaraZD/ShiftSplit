import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SignInScreen } from '@/components/sign-in-screen';
import { useShiftTracking } from '@/hooks/use-shift-tracking';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { PreferencesProvider, usePreferences } from '@/providers/preferences-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();
  const { notificationsEnabled } = usePreferences();
  useShiftTracking(session?.user.id, notificationsEnabled);

  return (
    <>
      {/* Stays visible (at least MIN_DISPLAY_MS) until auth has resolved, so
          the branded splash never hands off to the plain spinner below. */}
      <AnimatedSplashOverlay ready={!loading} />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-white dark:bg-black">
          <ActivityIndicator />
        </View>
      ) : !session ? (
        <SignInScreen />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      )}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PreferencesProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
