import * as Haptics from "expo-haptics";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { type ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Brand, Radii, Spacing, useTheme, sem } from "@/theme";

export type ButtonKind = "primary" | "secondary" | "plain" | "destructive" | "tinted";
export type ButtonSize = "sm" | "md" | "lg";

interface Props {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  size?: ButtonSize;
  sfSymbol?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: "light" | "medium" | "heavy" | "none";
  testID?: string;
  accessibilityLabel?: string;
}

const SIZE: Record<ButtonSize, { h: number; px: number; fs: number; ic: number }> = {
  sm: { h: 32, px: 12, fs: 13, ic: 14 },
  md: { h: 44, px: 16, fs: 15, ic: 18 },
  lg: { h: 52, px: 20, fs: 17, ic: 20 },
};

export function Button({
  label,
  onPress,
  kind = "primary",
  size = "md",
  sfSymbol,
  featherIcon,
  loading,
  disabled,
  fullWidth,
  haptic = "light",
  testID,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const s = SIZE[size];

  const bg =
    kind === "primary"
      ? Brand.teal
      : kind === "destructive"
      ? sem("systemRed")
      : kind === "tinted"
      ? Brand.teal + "1F"
      : kind === "secondary"
      ? sem("fillSecondary")
      : "transparent";

  const fg =
    kind === "primary"
      ? "#FFFFFF"
      : kind === "destructive"
      ? "#FFFFFF"
      : kind === "tinted"
      ? Brand.teal
      : kind === "secondary"
      ? sem("label")
      : Brand.teal;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={() => {
        if (disabled || loading) return;
        if (haptic !== "none" && t.isIOS) {
          const map = {
            light: Haptics.ImpactFeedbackStyle.Light,
            medium: Haptics.ImpactFeedbackStyle.Medium,
            heavy: Haptics.ImpactFeedbackStyle.Heavy,
          };
          Haptics.impactAsync(map[haptic]);
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          height: s.h,
          paddingHorizontal: s.px,
          borderRadius: Radii.md,
          opacity: disabled || loading ? 0.45 : pressed ? 0.78 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.row}>
          {sfSymbol && t.isIOS ? (
            <SymbolView name={sfSymbol} tintColor={fg} size={s.ic} />
          ) : featherIcon ? (
            <Feather name={featherIcon} size={s.ic} color={fg} />
          ) : null}
          <Text style={[styles.label, { color: fg, fontSize: s.fs }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  label: { fontWeight: "600", letterSpacing: -0.2 },
});
