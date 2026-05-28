import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";
import { Spacing, Radii, Motion, HitSlop, Brand, isIOS, isWeb } from "./tokens";

export { Spacing, Radii, Motion, HitSlop, Brand, isIOS, isWeb, Semantic, Typography };

export function useTheme() {
  const scheme = useColorScheme() ?? "light";
  const palette = Colors[scheme];
  return {
    scheme,
    palette,
    isDark: scheme === "dark",
    Semantic,
    Typography,
    Spacing,
    Radii,
    Motion,
    HitSlop,
    Brand,
    isIOS,
    isWeb,
  };
}

export type Theme = ReturnType<typeof useTheme>;

/** Convenience accessor: turn PlatformColor into something React Native styles will accept as a string. */
export const sem = (k: keyof typeof Semantic) => Semantic[k] as unknown as string;
