import { Platform } from "react-native";

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
  card: 14,
  sheet: 20,
} as const;

export const HitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export const Motion = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;

export const Brand = {
  teal: "#2DB8A0",
  tealDeep: "#1F8F7C",
  tealLight: "#3DD9BF",
  ink: "#0E2A47",
  inkMid: "#1C3A5E",
} as const;

export const isIOS = Platform.OS === "ios";
export const isWeb = Platform.OS === "web";
