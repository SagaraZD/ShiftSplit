import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'shiftsplit:preference:theme';
const NOTIFICATIONS_KEY = 'shiftsplit:preference:notifications-enabled';

interface PreferencesContextValue {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  loaded: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyThemePreference(value: ThemePreference) {
  // 'unspecified' tells RN to resume following the OS appearance setting.
  Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedTheme, storedNotifications] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
      ]);
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemePreferenceState(storedTheme);
        applyThemePreference(storedTheme);
      }
      if (storedNotifications !== null) {
        setNotificationsEnabledState(storedNotifications === 'true');
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

  const value = useMemo<PreferencesContextValue>(
    () => ({ themePreference, setThemePreference, notificationsEnabled, setNotificationsEnabled, loaded }),
    [themePreference, notificationsEnabled, loaded]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
}
