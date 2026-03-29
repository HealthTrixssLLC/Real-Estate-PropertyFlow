import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

interface StarRatingProps {
  value: number | null | undefined;
  onChange?: (val: number) => void;
  size?: number;
  color?: string;
}

export function StarRating({
  value,
  onChange,
  size = 22,
  color = "#F5A623",
}: StarRatingProps) {
  const isIOS = Platform.OS === "ios";
  const filled = Math.round(value ?? 0);

  const handlePress = (n: number) => {
    if (!onChange) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(n === filled ? 0 : n);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          testID={`star-${n}`}
          onPress={() => handlePress(n)}
          hitSlop={6}
        >
          {isIOS ? (
            <SymbolView
              name={n <= filled ? "star.fill" : "star"}
              tintColor={n <= filled ? color : "#D0D9E8"}
              size={size}
            />
          ) : (
            <Feather
              name="star"
              size={size}
              color={n <= filled ? color : "#D0D9E8"}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
  },
});
