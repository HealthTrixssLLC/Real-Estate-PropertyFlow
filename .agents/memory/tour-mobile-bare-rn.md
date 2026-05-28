---
name: tour-mobile bare RN shim layer
description: How the bare-RN tour-mobile artifact stays compatible with screens originally written for Expo SDK 54, via drop-in shims in src/lib/*.
---

The tour-mobile artifact was converted from Expo SDK 54 to bare React Native 0.81 with a committed `ios/TourFlow.xcworkspace`. To avoid rewriting every screen, all Expo APIs the screens used are re-exposed under `@/lib/*` with byte-identical call signatures:

- `@/lib/navigation` — `router`, `useRouter`, `useLocalSearchParams`, `usePathname`, `Redirect`, `Link`, `navigationRef`. Backed by React Navigation. Imperative `router.push("/tour/abc")` is parsed against a hand-written path table in `resolveHref()` (mirrors RootStackParamList).
- `@/lib/icon` — `IconSymbol` + back-compat `SymbolView` alias over `react-native-sfsymbols`. Exports a no-op `Feather` so unreachable `isIOS ? <SymbolView/> : <Feather/>` branches still compile.
- `@/lib/audio` — `Audio.Recording.createAsync(...)`, `Audio.requestPermissionsAsync()`, `Audio.setAudioModeAsync()`, `Audio.RecordingOptionsPresets.HIGH_QUALITY` over `react-native-audio-recorder-player`.
- `@/lib/haptics`, `@/lib/linking`, `@/lib/splash-screen`, `@/lib/glass-effect` — small wrappers or no-op stubs.

**Why:** Conversion goal was visual/behavioral parity without touching screen logic. Editing 15 screens to switch navigation paradigms (expo-router file-routing → React Navigation imperative) would have multiplied risk; the shim layer absorbs that. `router.push` path-string parsing is the load-bearing piece — keep it in sync with the route table whenever a screen is added.

**How to apply:**
- When adding a new screen, register it in three places: `RootStackParamList` (`@/lib/navigation`), `RootNavigator.tsx`, and the `resolveHref` switch + `usePathname` switch in `@/lib/navigation`. Otherwise `router.push("/new/path")` silently no-ops.
- Don't reintroduce `expo-*` imports — the task constraint is no Expo deps. Add new native deps directly (e.g. `react-native-*`) and link via CocoaPods autolinking.
- `process.env.EXPO_PUBLIC_*` does NOT work in bare RN. Read runtime URLs from `src/config.ts` (`API_URL`) instead.
- The Replit web preview is a stub (`server/serve.js` on port 22753) — the app only builds/runs from Xcode.
