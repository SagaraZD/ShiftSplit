import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type FontSizePreference = 'small' | 'medium' | 'large' | 'extraLarge';

const THEME_KEY = 'shiftsplit:preference:theme';
const NOTIFICATIONS_KEY = 'shiftsplit:preference:notifications-enabled';
const FONT_SIZE_KEY = 'shiftsplit:preference:font-size';

// "small" is the app's existing baseline sizing — every text-size Tailwind
// class already in use is designed against a 1x scale, so small stays at 1.
export const FONT_SCALES: Record<FontSizePreference, number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
  extraLarge: 1.45,
};

interface PreferencesContextValue {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  fontSizePreference: FontSizePreference;
  setFontSizePreference: (value: FontSizePreference) => void;
  fontScale: number;
  loaded: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyThemePreference(value: ThemePreference) {
  // 'unspecified' tells RN to resume following the OS appearance setting.
  Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
}

function isFontSizePreference(value: string): value is FontSizePreference {
  return value === 'small' || value === 'medium' || value === 'large' || value === 'extraLarge';
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [fontSizePreference, setFontSizePreferenceState] = useState<FontSizePreference>('small');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedTheme, storedNotifications, storedFontSize] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
        AsyncStorage.getItem(FONT_SIZE_KEY),
      ]);
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemePreferenceState(storedTheme);
        applyThemePreference(storedTheme);
      }
      if (storedNotifications !== null) {
        setNotificationsEnabledState(storedNotifications === 'true');
      }
      if (storedFontSize !== null && isFontSizePreference(storedFontSize)) {
        setFontSizePreferenceState(storedFontSize);
      }
      setLoaded(true);
    })();
  }, []);

  const setThemePreference = (value: ThemePreference) => {
    setThemePreferenceState(value);
    applyThemePreference(value);
    AsyncStorage.setItem(THEME_KEY, value);
  };

  const setNotificationsEnabled = (value: boolean) => {
    setNotificationsEnabledState(value);
    AsyncStorage.setItem(NOTIFICATIONS_KEY, value ? 'true' : 'false');
  };

  const setFontSizePreference = (value: FontSizePreference) => {
    setFontSizePreferenceState(value);
    AsyncStorage.setItem(FONT_SIZE_KEY, value);
  };

  const value = useMemo<PreferencesContextValue>(
    () => ({
      themePreference,
      setThemePreference,
      notificationsEnabled,
      setNotificationsEnabled,
      fontSizePreference,
      setFontSizePreference,
      fontScale: FONT_SCALES[fontSizePreference],
      loaded,
    }),
    [themePreference, notificationsEnabled, fontSizePreference, loaded]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
}
