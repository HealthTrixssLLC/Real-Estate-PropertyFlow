import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, sem } from "@/theme";

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Big iOS large-title-style header that lives inside a scroll view. */
export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: sem("label") as string }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: sem("labelSecondary") as string }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
  },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 15, marginTop: 2 },
});
