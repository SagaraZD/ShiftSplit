# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

ShiftSplit — an Expo/React Native app that tracks work hours across two NZ office locations (Mangere, Highbrook) against a 40h/week target. Clock in/out is driven by geofencing (background location + notifications), with a Supabase backend for auth, data, realtime sync, and avatar storage.

## Commands

```bash
npm run ios              # expo run:ios — builds and launches the native iOS app (required after adding a native module)
npm run android           # expo run:android
npm start                 # expo start — Metro only, for JS-only changes when a dev client is already installed
npm run web               # expo start --web
npm run lint              # expo lint (eslint-config-expo flat config)
npx tsc --noEmit -p tsconfig.json   # typecheck (no test suite exists — this is the primary correctness gate)
```

- `postinstall` runs `patch-package` automatically after `npm install` — patches in `patches/` fix bugs in third-party `node_modules` (currently a NativeWind web color-scheme crash) and must keep applying cleanly.
- Any change that adds/updates a native dependency (new Expo module, Podfile change) requires a full `npm run ios` rebuild, not just a Metro reload — a JS-only reload won't pick up new native code.
- Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` before running; `src/lib/supabase.ts` throws at import time if either is missing.
- `schema.sql` is the full Supabase setup (tables, RLS, RPC, Realtime publication, storage bucket + policies) — run it once in the Supabase SQL Editor. Any schema change made in the app must be mirrored back into this file since there are no migration files.

## Architecture

**Routing (Expo Router, typed routes):** `src/app/_layout.tsx` is the root — it wraps everything in `PreferencesProvider` → `AuthProvider`, then branches on auth state: loading spinner, `SignInScreen` (unauthenticated), or a root `Stack` with two siblings: the `(tabs)` group and `settings` (presented as a modal). This split exists specifically so Settings can be pushed as a modal from *any* tab while the tab bar itself stays a separate native component tree. `(tabs)/_layout.tsx` renders `AppTabs` (`src/components/app-tabs.tsx`), which uses `expo-router/unstable-native-tabs` (`NativeTabs`) for a truly native tab bar — `app-tabs.web.tsx` is the web fallback. Screen files under `(tabs)/` (`index.tsx` = Dashboard, `history.tsx`) are matched to `NativeTabs.Trigger name="..."` by filename, so renaming a screen file means updating the trigger name too.

**Auth & preferences are two separate providers, both above the auth gate:**
- `src/providers/auth-provider.tsx` wraps Supabase auth (session, sign in/up/out, `updateProfile` which writes `display_name`/`avatar_url` into Supabase Auth's `user_metadata` — there is no separate `profiles` table).
- `src/providers/preferences-provider.tsx` persists theme choice and notifications-enabled to AsyncStorage and applies theme immediately via `Appearance.setColorScheme()` (pass `'unspecified'`, not `null`, to resume following the OS setting — that's the actual RN 0.86 type). It's mounted *outside* `AuthProvider` because preferences (e.g. dark mode) should apply even on the sign-in screen.

**Geofencing → notification → clock-in pipeline** (`src/services/geofence-service.ts`, `notification-service.ts`, `src/hooks/use-shift-tracking.ts`): office coordinates live in `src/constants/locations.ts` (keep `LOCATION_IDS` in sync with the seeded UUIDs in `schema.sql`). Region monitoring is OS-driven (`expo-location` geofencing via `expo-task-manager`, no JS polling loop). Entering a geofence fires a clock-in prompt notification; exiting schedules a delayed clock-out prompt that gets cancelled if the user re-enters before it fires. `useShiftTracking(userId, enabled)` in the root layout registers/unregisters the geofences based on the `notificationsEnabled` preference — toggling notifications off in Settings actually tears down the OS-level geofence registration, not just local notification display.

**Realtime data hooks all share one subscription primitive:** `src/hooks/use-realtime-work-logs.ts` centralizes the Supabase Realtime `postgres_changes` subscription used by `use-active-session`, `use-weekly-summary`, `use-week-logs`, and `use-monthly-summary`. It mints a unique channel topic per effect invocation (a monotonic counter) specifically to dodge a Supabase-client + React Strict Mode race: Supabase reuses a channel object for a repeated topic name, and `removeChannel`'s unsubscribe is async, so Strict Mode's synchronous mount→cleanup→mount in dev can hand the second mount an already-subscribed channel and crash on `.on()`. Any new realtime-backed hook should go through this shared hook rather than calling `supabase.channel()` directly. Realtime alone isn't reliable for screens in a background tab, so the hook also refreshes on local writes (every mutation in `work-log-service.ts` calls `notifyWorkLogsChanged()`) and when the app returns to the foreground — any new `work_logs` write must go through that service and notify, or other tabs won't update.

**Data flow for hours/targets:** `schema.sql`'s `get_weekly_summary(p_user_id, p_start_date)` RPC (SECURITY INVOKER, so RLS still scopes it to the caller) returns per-location totals plus the week's target/overtime; `src/lib/aggregate.ts` and `src/lib/date-utils.ts` shape that into what the Dashboard/History screens render (`ProgressRingCard`, `LocationBreakdownCard`, `WeeklyBarChart`, etc. under `src/components/shift/`).

**Avatar upload:** `src/services/avatar-service.ts` uses `expo-image-picker` to get a base64 image, decodes it with `base64-arraybuffer`, and uploads to the Supabase Storage `avatars` bucket at `<user id>/<filename>` — RLS-style storage policies (in `schema.sql`) restrict writes to that folder prefix per user. The public URL is then written to `user_metadata.avatar_url` via `updateProfile`.

**Styling:** NativeWind v4 (Tailwind classes directly in JSX) with `darkMode: 'media'` — dark mode is automatic from OS/`Appearance`, not a manual class toggle; `patches/react-native-css-interop+*.patch` fixes a web-only crash when NativeWind tries to read `documentElement.classList` under the `media` strategy. `src/constants/theme.ts` holds the light/dark color tokens used by non-NativeWind native components (e.g. `NativeTabs` colors, chart colors) where inline Tailwind classes don't apply.

**iOS native layer:** custom `SceneDelegate` in `ios/ShiftSplit/AppDelegate.swift` + `UIApplicationSceneManifest` in `Info.plist` (required for this Expo/RN version's mandatory UIScene lifecycle on iOS), and a `Podfile` `post_install` hook that replaces a buggy Expo Constants build-phase script (path-quoting bug when the repo path contains spaces — this repo's path does).
