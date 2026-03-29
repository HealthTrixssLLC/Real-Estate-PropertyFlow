import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";

interface StopProgressBarProps {
  total: number;
  visited: number;
  skipped: number;
}

export function StopProgressBar({ total, visited, skipped }: StopProgressBarProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];

  const remaining = total - visited - skipped;
  const visitedPct = total > 0 ? visited / total : 0;
  const skippedPct = total > 0 ? skipped / total : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: C.textSecondary }]}>
          {visited}/{total} stops
        </Text>
        <Text style={[styles.label, { color: C.textSecondary }]}>
          {remaining} remaining
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: C.border }]}>
        <View style={[styles.fill, { width: `${visitedPct * 100}%`, backgroundColor: C.accent }]} />
        {skippedPct > 0 && (
          <View
            style={[
              styles.fill,
              {
                width: `${skippedPct * 100}%`,
                backgroundColor: C.textTertiary,
                opacity: 0.5,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  track: {
    height: 6,
    borderRadius: 3,
    flexDirection: "row",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
