import * as Haptics from "@/lib/haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Radii, Spacing, useTheme, sem } from "@/theme";

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, testID }: Props<T>) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        { backgroundColor: sem("fillTertiary") as string, borderRadius: Radii.md },
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) {
                onChange(o.value);
                if (t.isIOS) Haptics.selectionAsync();
              }
            }}
            style={[
              styles.seg,
              active && {
                backgroundColor: t.isDark ? "#48484A" : "#FFFFFF",
                borderRadius: Radii.md - 2,
                shadowColor: "#000",
                shadowOpacity: t.isDark ? 0 : 0.06,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? (sem("label") as string) : (sem("labelSecondary") as string),
                  fontWeight: active ? "600" : "500",
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", padding: 2, alignSelf: "stretch" },
  seg: { flex: 1, paddingVertical: 7, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, letterSpacing: -0.08 },
});
