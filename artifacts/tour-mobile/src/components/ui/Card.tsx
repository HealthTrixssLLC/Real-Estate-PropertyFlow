import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Radii, Spacing, sem } from "@/theme";

interface Props {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, onPress, padded = true, style, testID }: Props) {
  const base = [
    styles.card,
    { backgroundColor: sem("groupedSurface") as string },
    padded && styles.padded,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={base}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    overflow: "hidden",
  },
  padded: {
    padding: Spacing.lg,
  },
});
