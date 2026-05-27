---
name: iOS Native UI Overhaul
description: Durable decisions and constraints from the iOS native UI overhaul of tour-mobile
---

## System Font
Replaced all `fontFamily: "Inter_*"` with `fontWeight` equivalents. Root `_layout.tsx` no longer loads fonts at all — SplashScreen.hideAsync() fires in a plain `useEffect([])`.

**Why:** System SF Pro is more native; eliminates font loading race conditions and startup lag.

## Semantic Color Tokens
`constants/semantic.ts` — PlatformColor-based adaptive tokens (systemBackground, label, separator, etc.). `constants/colors.ts` re-exports `Semantic` and `Typography` for convenience.

**How to apply:** Use `Semantic.*` for structural UI (backgrounds, text, borders). Use `Colors[scheme].*` only for brand/custom colors (teal, chip colors, etc.). Cast with `as unknown as string` when using PlatformColor values inside `StyleSheet.create()`.

## Typography Scale
`constants/typography.ts` — iOS Human Interface Guidelines type scale (largeTitle through caption2 + `sectionHeader` preset). Spread into StyleSheet: `...Typography.headline`.

## Native Navigation Headers
`(tabs)/_layout.tsx`: `headerShown: false` ONLY on the Today (`index`) tab. All list tabs use native nav bars with `headerTransparent: true` on iOS and teal tint.

**Key constraint:** `headerLargeTitle` and `headerBlurEffect` are NOT in Expo Router's `TabsProps` type in the installed version — causes TS2353. Removed. Use `navigation.setOptions()` inside screen components for per-screen header customization.

## Filter ActionSheet Pattern (Tours)
Replaced custom pill-button filter bar with `ActionSheetIOS.showActionSheetWithOptions` triggered from a `line.3.horizontal.decrease.circle` SF Symbol in `headerRight`. Non-iOS falls back to `Alert.alert`. An active-filter banner row (dismissable) shows below the nav bar when filter is not default.

**How to apply:** For any list screen that needs sorting/filtering, put the trigger in `navigation.setOptions({ headerRight })` and use `ActionSheetIOS` on iOS.

## iOS Inset-Grouped Sections (Stop Detail)
- Container background: `Semantic.grouped` (systemGroupedBackground)
- Card background: `Semantic.groupedSurface` (secondarySystemGroupedBackground), `borderRadius: 12`, no `borderWidth`
- Section headers: `Typography.sectionHeader` (uppercase 13pt + tracking) + `C.textSecondary` color
- Row separators: `Semantic.opaqueSeparator` (use `as unknown as string` in StyleSheet.create)
- `contentInsetAdjustmentBehavior="automatic"` on all list ScrollViews/FlatLists

## Haptics Pattern
- Selection toggle (flag, tag): `Haptics.selectionAsync()`
- Rating change: `Haptics.selectionAsync()`
- Flag toggle: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- FAB / heavy CTA: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
- Save success: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- expo-haptics is already installed; import as `import * as Haptics from "expo-haptics"`

## Pre-existing TypeScript Errors (Do Not Fix in This Task)
These files have pre-existing TS errors unrelated to the UI overhaul:
- `app/buyers/[buyerId].tsx` — missing exports from @workspace/api-client-react
- `app/stop/[stopId].tsx` — `useGetTour` query missing `queryKey` option
- `app/tour/[tourId].tsx` — similar api-client-react type issues
