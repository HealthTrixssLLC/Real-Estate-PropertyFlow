/**
 * Runtime configuration. Bare React Native does not inline `process.env.*`
 * the way Expo did, so we centralize the API base URL here. Edit `API_URL`
 * to point at your deployed tour-planner backend.
 *
 * For dev builds, set the `API_URL` global in your iOS scheme env block
 * via Xcode (Run > Arguments > Environment Variables), or replace the
 * fallback string below.
 */
declare const __DEV__: boolean;

const FALLBACK_PROD_URL = "https://tour-planner.replit.app";
const FALLBACK_DEV_URL = "http://localhost:5000";

export const API_URL: string =
  (typeof process !== "undefined" && process.env?.API_URL) ||
  (__DEV__ ? FALLBACK_DEV_URL : FALLBACK_PROD_URL);
