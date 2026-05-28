---
name: expo-file-system on Expo SDK 54
description: Two non-obvious constraints when using expo-file-system inside an Expo SDK 54 project — version pinning and the /legacy subpath requirement.
---

# expo-file-system on Expo SDK 54

Two independent traps land together and look like one bug:

1. **Version pin.** With `expo: ~54.x`, `expo-file-system` must be on the `~19.0.x` line, NOT `55.x`/`56.x`. The 55+ rewrite ships Swift that calls `EXFileSystemInterface.getPathPermissions(...)`, which doesn't exist in SDK 54's core. Xcode fails with:
   ```
   expo-file-system/ios/FileSystemModule.swift
   value of type 'any EXFileSystemInterface' has no member 'getPathPermissions'
   ```
   Fix: `pnpm --filter <mobile> exec expo install expo-file-system` (or pin `~19.0.20` manually) and re-run `expo prebuild --clean --platform ios`.

2. **`/legacy` subpath required at runtime.** On 19.x, the *root* export of `expo-file-system` declares `readAsStringAsync`, `getInfoAsync`, etc. as `@deprecated ... will throw in runtime` stubs. TypeScript still compiles against the root because the types exist, so this is invisible to `tsc` — but the call throws as soon as it runs on device. Always import the classic API from `expo-file-system/legacy`:
   ```ts
   const FileSystem = await import("expo-file-system/legacy");
   await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
   ```
   The new `File` class API lives on the root export if you'd rather migrate.

**Why:** Both traps are silent — version mismatch only fires when someone builds in Xcode (not on Replit Linux), and the `/legacy` issue only fires at runtime on device (not in typecheck or web preview).

**How to apply:** Whenever you touch `expo-file-system` on a SDK 54 project, verify both the package.json pin (`~19.0.x`) AND that every import path includes `/legacy`. If you bump Expo SDK, drop the `/legacy` suffix and migrate to the `File` API.
