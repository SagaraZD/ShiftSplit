# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

ShiftSplit — an Expo/React Native app that tracks work hours across two NZ office locations (Mangere, Highbrook) against a 40h/week target. Users sign in/out manually; the app sends a local notification when the day reaches 8h and the backend emails them when the week reaches 40h. Supabase is the backend for auth, data, realtime sync, and avatar storage.

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
- Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` before running; `src/lib/supabase.ts` throws at import time if either is missing. `EXPO_PUBLIC_NZ_HOLIDAYS_API_KEY` is optional and only feeds public holidays into the Calendar tab (`src/services/holiday-service.ts`).
- `schema.sql` is the full Supabase setup (tables, RLS, RPC, Realtime publication, storage bucket + policies, and the `pg_cron` job for the weekly email) — run it once in the Supabase SQL Editor. Any schema change made in the app must be mirrored back into this file since there are no migration files.
- `supabase/functions/weekly-target-email/` is a Deno Edge Function (deploy with `npx supabase functions deploy weekly-target-email`). A `pg_cron` job in `schema.sql` calls it every 15 minutes on Thu/Fri UTC; it only acts on NZ Fridays from 8am, emailing a user (once per week) when their net hours for the week have reached 40h, via Resend (`supabase secrets set RESEND_API_KEY=...`). The `weekly_target_emails` table records who has been emailed. It only accepts calls carrying the service role key, and it is not part of the app's TypeScript project (there's no local Deno, so `tsc` doesn't check it).
- `eas.json` has `development` / `preview` / `production` build profiles (`appVersionSource: remote`, production auto-increments).

## Architecture

**Routing (Expo Router, typed routes):** `src/app/_layout.tsx` is the root. It loads the brand font, wraps everything in `PreferencesProvider` → `AuthProvider`, then branches on auth state: a loading screen behind `AnimatedSplashOverlay`, `SignInScreen` (unauthenticated), or a root `Stack` containing only the `(tabs)` group. `(tabs)/_layout.tsx` renders `AppTabs` (`src/components/app-tabs.tsx`), which uses `expo-router/unstable-native-tabs` (`NativeTabs`) for a truly native tab bar; `app-tabs.web.tsx` is the web fallback. The screen files under `(tabs)/` (`index.tsx` = Home/Dashboard, `calendar.tsx`, `history.tsx`) are matched to `NativeTabs.Trigger name="..."` by filename, so renaming a screen file means updating the trigger name too. Settings is not a route: it is `SettingsSheet` (`src/components/settings-sheet.tsx`), opened as a sheet from the Dashboard.

**Auth & preferences are two separate providers, both above the auth gate:**
- `src/providers/auth-provider.tsx` wraps Supabase auth (session, sign in/up/out). Display name and avatar live in a `public.profiles` table (a `handle_new_user` trigger in `schema.sql` creates the row on sign-up), read through `use-profile.ts` and written through `profile-service.ts`'s `updateProfile` (an upsert).
- `src/providers/preferences-provider.tsx` persists theme, notifications-enabled, font size and the weekend sign-in toggle to AsyncStorage and applies theme immediately via `Appearance.setColorScheme()` (pass `'unspecified'`, not `null`, to resume following the OS setting — that's the actual RN 0.86 type). It's mounted *outside* `AuthProvider` because preferences (e.g. dark mode) should apply even on the sign-in screen.

**Notifications = only the 8-hour alert** (`src/hooks/use-daily-target-alert.ts`, `src/services/notification-service.ts`): mounted in the root layout, it keeps one OS-scheduled local notification (fixed identifier) set for when the open session takes that day's net time to 8h. That means 8h30m raw, counting sessions already closed that day. It re-works this out on every work_logs change through `useRealtimeWorkLogs`, and cancels when there's no open session, the moment has passed, the Settings toggle (`notificationsEnabled`) is off, or the user signs out. There is no geofencing or location use any more (`expo-location`/`expo-task-manager` were removed); `OFFICE_GEOFENCES` in `src/constants/locations.ts` is just office metadata (name, color), and its `LOCATION_IDS` must match the UUIDs seeded in `schema.sql`.

**Realtime data hooks all share one subscription primitive:** `src/hooks/use-realtime-work-logs.ts` centralizes the Supabase Realtime `postgres_changes` subscription used by `use-active-session`, `use-weekly-summary`, `use-week-logs`, and `use-monthly-summary`. It mints a unique channel topic per effect invocation (a monotonic counter) specifically to dodge a Supabase-client + React Strict Mode race: Supabase reuses a channel object for a repeated topic name, and `removeChannel`'s unsubscribe is async, so Strict Mode's synchronous mount→cleanup→mount in dev can hand the second mount an already-subscribed channel and crash on `.on()`. Any new realtime-backed hook should go through this shared hook rather than calling `supabase.channel()` directly. Realtime alone isn't reliable for screens in a background tab, so the hook also refreshes on local writes (every mutation in `work-log-service.ts` calls `notifyWorkLogsChanged()`) and when the app returns to the foreground — any new `work_logs` write must go through that service and notify, or other tabs won't update.

**Data flow for hours/targets:** `schema.sql`'s `get_weekly_summary(p_user_id, p_start_date)` RPC (SECURITY INVOKER, so RLS still scopes it to the caller) returns per-location totals plus the week's target/overtime; `src/lib/aggregate.ts` computes the same totals client-side from raw `work_logs` rows for the Dashboard/Calendar/History views (components under `src/components/shift/`).

**Hours rules are duplicated in three places and must stay in agreement:** the work week is Monday–Friday, the target is 40h/week (8h/day), and a 30-minute unpaid lunch is deducted once per calendar day worked (not once per session) and then spread across that day's logs in proportion to their minutes. These rules live in `src/constants/locations.ts` + `src/lib/aggregate.ts` + `use-daily-target-alert.ts` (client), the `get_weekly_summary` RPC in `schema.sql` (hardcoded `30`/`2400`), and `supabase/functions/weekly-target-email/index.ts` (its own constants and NZ-date logic). Change one and you must change all three.

**Dates are NZ-local calendar dates:** the SQL anchors days to `Pacific/Auckland`. On the client, build date keys from local fields (`toISODate` in `src/lib/date-utils.ts`), never from `.toISOString().slice(0, 10)`: NZ is ahead of UTC, so a local midnight turned into UTC falls on the previous day. This bug has already shipped once. `.toISOString()` is still correct for timestamps sent to Supabase.

**Avatar upload:** `src/services/avatar-service.ts` uses `expo-image-picker` to get a base64 image, decodes it with `base64-arraybuffer`, and uploads to the Supabase Storage `avatars` bucket at `<user id>/<filename>` — RLS-style storage policies (in `schema.sql`) restrict writes to that folder prefix per user. The public URL is then saved to `profiles.avatar_url` via `profile-service.ts`'s `updateProfile`.

**Styling:** NativeWind v4 (Tailwind classes directly in JSX) with `darkMode: 'media'` — dark mode is automatic from OS/`Appearance`, not a manual class toggle; `patches/react-native-css-interop+*.patch` fixes a web-only crash when NativeWind tries to read `documentElement.classList` under the `media` strategy. `src/constants/theme.ts` holds the light/dark color tokens used by non-NativeWind native components (e.g. `NativeTabs` colors, chart colors) where inline Tailwind classes don't apply.

**Font size setting:** use `Text`/`TextInput` from `src/components/ui/text.tsx` instead of the `react-native` ones. The wrapper scales the resolved `fontSize`/`lineHeight` by the preference's `fontScale`, so plain RN `Text` ignores the user's font size setting.

**iOS native layer:** custom `SceneDelegate` in `ios/ShiftSplit/AppDelegate.swift` + `UIApplicationSceneManifest` in `Info.plist` (required for this Expo/RN version's mandatory UIScene lifecycle on iOS), and a `Podfile` `post_install` hook that replaces a buggy Expo Constants build-phase script (path-quoting bug when the repo path contains spaces — this repo's path does).
