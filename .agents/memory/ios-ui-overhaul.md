---
name: iOS Native UI Overhaul
description: Key decisions and constraints from the iOS native UI overhaul of tour-mobile app
---

## System Font
All `fontFamily: "Inter_*"` replaced with `fontWeight` equivalents via sed sweep across 19 files in `app/` and `components/`. Root `_layout.tsx` no longer loads Inter fonts at all — SplashScreen.hideAsync() called in a simple `useEffect([])`.

**Why:** System SF Pro looks dramatically more native; eliminates font loading race conditions.

## Color System
`constants/colors.ts` updated to iOS semantic palette:
- Light: bg `#F2F2F7`, surface `#FFFFFF`, surfaceAlt `#EFEFF4`, text `#000000`, secondary `#6B6B72`, tertiary `#AEAEB2`, border `#C6C6C8`
- Dark: bg `#000000`, surface `#1C1C1E`, surfaceAlt `#2C2C2E`, text `#FFFFFF`, secondary `#8E8E93`, border `#38383A`

## Native Navigation Headers
`(tabs)/_layout.tsx` now has `headerShown: false` ONLY on the `index` (Today) tab. All other tabs (Tours, Buyers, Notes, Settings) show native navigation bars with `headerTransparent: true` on iOS.

**Key constraint:** `headerLargeTitle` is NOT in the `TabsProps` type in this version of Expo Router — causes TS2353. Removed from layout file. Use `useNavigation().setOptions()` within screen components instead if needed per-screen.

**How to apply:** Any future tab that needs a large title should use `navigation.setOptions({ headerLargeTitle: true })` inside the screen component via useEffect.

## TourCard Native Cell
`TourCard.tsx` redesigned as flat list cell: 10px status dot (left), title/meta/chip (body), chevron (right). No card border radius or shadow. `borderBottomWidth: StyleSheet.hairlineWidth` as separator.

## Buyers + Button
Moved from custom header View to `useNavigation().setOptions({ headerRight: ... })` via `useCallback`+`useEffect` inside `buyers.tsx`.

## Today Screen (index.tsx)
Converted from FlatList to ScrollView for dashboard layout. Tour cards wrapped in `<View style={styles.group}>` with `borderRadius: 12, overflow: 'hidden'` for iOS grouped appearance.
