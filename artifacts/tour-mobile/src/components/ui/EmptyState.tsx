import { SymbolView, type SFSymbol } from "@/lib/icon";
import { Feather } from "@/lib/icon";
import React, { type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, useTheme, sem } from "@/theme";

interface Props {
  sfSymbol?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ sfSymbol, featherIcon, title, message, action }: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {sfSymbol && t.isIOS ? (
        <SymbolView name={sfSymbol} tintColor={sem("labelTertiary") as string} size={56} />
      ) : featherIcon ? (
        <Feather name={featherIcon} size={48} color={sem("labelTertiary") as string} />
      ) : null}
      <Text style={[styles.title, { color: sem("label") as string }]}>{title}</Text>
      {message && (
        <Text style={[styles.message, { color: sem("labelSecondary") as string }]}>{message}</Text>
      )}
      {action && <View style={{ marginTop: Spacing.md }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
    gap: Spacing.md,
  },
  title: { fontSize: 20, fontWeight: "600", textAlign: "center", letterSpacing: 0.38 },
  message: { fontSize: 15, textAlign: "center", lineHeight: 20, maxWidth: 320 },
});
