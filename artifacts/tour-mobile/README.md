# TourFlow Mobile

Expo SDK 54 React Native app (iOS-first). The `ios/` folder is **generated** by `expo prebuild` and is not checked into git — see the iOS build flow below.

## Prerequisites (Mac, for iOS development)

- Node.js (use the version pinned at the repo root)
- pnpm (`npm i -g pnpm`)
- Xcode 16+ with Command Line Tools installed
- CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`)
- An iOS Simulator (installed via Xcode → Settings → Platforms)

## Install dependencies

From the **repo root**:

```bash
pnpm install
```

## Run on iOS Simulator (Xcode flow)

The iOS native project lives in `ios/` and is **regenerated** by Expo Prebuild — you should never hand-edit anything under `ios/`. Anything you need to configure for native iOS goes in `app.json`.

```bash
# 1. Generate the native iOS project from app.json + installed Expo modules
pnpm --filter @workspace/tour-mobile exec expo prebuild --clean --platform ios

# 2. Install CocoaPods dependencies
cd artifacts/tour-mobile/ios
pod install

# 3. Open the workspace in Xcode (always the .xcworkspace, never the .xcodeproj)
open *.xcworkspace
```

Then in Xcode: pick an iPhone simulator from the device dropdown and press **Run** (⌘R).

Alternatively, build & run entirely from the command line:

```bash
cd artifacts/tour-mobile
pnpm exec expo run:ios
```

## Run on a physical iPhone

1. Plug the iPhone into the Mac and trust the computer.
2. In Xcode, select the device from the device dropdown.
3. Set a development team on the app target (Signing & Capabilities tab) — Apple ID free tier works for personal devices.
4. Press **Run**.

## Run Metro standalone (for fast reloads while Xcode is already open)

```bash
pnpm --filter @workspace/tour-mobile run dev
```

## Web preview

The mobile app also runs as a web preview on Replit at `/tour-mobile/` (powered by `react-native-web` via `expo-router`). This is automatic when the Replit workflow is running.

## Environment variables

The mobile app reads these at runtime (most are injected automatically by the Replit dev script — only set them manually for local iOS builds against a custom API):

- `EXPO_PUBLIC_API_URL` — full API base URL (takes precedence). Use this for Mac/Xcode builds, e.g. `https://your-replit-app.replit.dev`.
- `EXPO_PUBLIC_DOMAIN` — fallback API host (the dev script sets this to `$REPLIT_DEV_DOMAIN`).
- `EXPO_PUBLIC_REPL_ID` — Replit ID for asset URLs (dev script only).

For local iOS development against the deployed API server, the simplest setup is:

```bash
export EXPO_PUBLIC_API_URL="https://your-deployed-api.example.com"
pnpm --filter @workspace/tour-mobile exec expo run:ios
```

## Typecheck

```bash
pnpm --filter @workspace/tour-mobile run typecheck
```

## Known limitations & gotchas

- **`ios/` is generated, not committed.** Re-run `expo prebuild --clean --platform ios` whenever you change `app.json`, add/remove an Expo module, or after a fresh clone. Manual edits to anything in `ios/` will be overwritten.
- **`expo-file-system` version is pinned to the SDK 54 line (`~19.0.20`)**, not the newer `55.x`/`56.x` rewrite. The 55+ line ships Swift that calls `EXFileSystemInterface.getPathPermissions(...)`, an API that doesn't exist in Expo SDK 54's core — building with it produces the canonical error:

  ```
  expo-file-system/ios/FileSystemModule.swift
  value of type 'any EXFileSystemInterface' has no member 'getPathPermissions'
  CommandError: Failed to build iOS project. "xcodebuild" exited with error code 65.
  ```

  If you see this again, check `package.json`: `expo-file-system` must be `~19.0.x` while `expo` is `~54.x`. Run `pnpm --filter @workspace/tour-mobile exec expo install --check` to have Expo confirm version alignment.

- **`expo-file-system` must be imported from `expo-file-system/legacy`** (not the root). On the 19.x line, the root export marks classic methods like `readAsStringAsync`, `getInfoAsync`, etc. as deprecated and they **throw at runtime**. The `/legacy` subpath preserves the previous behavior. The new `File` class API from the root export is also available if you'd rather migrate.

- **CocoaPods cache.** If `pod install` fails after a prebuild, delete `ios/Pods/` and `ios/Podfile.lock` and re-run `pod install`.

- **New Architecture is enabled** (`"newArchEnabled": true` in `app.json`). All native modules used by this app are New-Architecture compatible — if you add a new native module that isn't, you'll need to either disable the new arch or replace the module.
