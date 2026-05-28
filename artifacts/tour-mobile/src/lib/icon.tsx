import React from "react";
import { Text, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { SFSymbol as RNSFSymbol } from "react-native-sfsymbols";

export type SFSymbol = string;

interface IconSymbolProps {
  name: SFSymbol;
  tintColor?: string;
  size?: number;
  weight?: "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";
  scale?: "small" | "medium" | "large";
  style?: StyleProp<ViewStyle>;
  resizeMode?: "center" | "scaleAspectFit" | "scaleAspectFill";
}

/**
 * Drop-in replacement for expo-symbols' SymbolView, backed by
 * react-native-sfsymbols which uses native UIImage(systemName:).
 * iOS-only; renders a small empty View on other platforms so the
 * tree compiles cleanly.
 */
export function IconSymbol({
  name,
  tintColor = "#000",
  size = 24,
  weight = "regular",
  scale = "medium",
  style,
  resizeMode = "center",
}: IconSymbolProps) {
  return (
    <RNSFSymbol
      name={name}
      weight={weight}
      scale={scale}
      color={tintColor}
      size={size}
      resizeMode={resizeMode}
      multicolor={false}
      style={[{ width: size, height: size }, style]}
    />
  );
}

// Back-compat alias matching the expo-symbols import name so any
// `SymbolView` callsites keep working even if a stray reference remains.
export const SymbolView = IconSymbol;

interface FeatherProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Stub for `@expo/vector-icons`' Feather. Existing screens use the pattern
 * `isIOS ? <SymbolView /> : <Feather />` so on this iOS-only build the
 * Feather branch is never rendered. We keep it as a no-op placeholder so
 * the unreachable branch still type-checks.
 */
export function Feather(_props: FeatherProps) {
  return <View />;
}

// Re-export Text just to keep TS happy if any consumer needed it.
export const _IconNoop = Text;
