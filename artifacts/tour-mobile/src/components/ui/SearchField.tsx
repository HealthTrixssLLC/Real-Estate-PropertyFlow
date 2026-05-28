import { SymbolView } from "@/lib/icon";
import { Feather } from "@/lib/icon";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Radii, Spacing, useTheme, sem } from "@/theme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}

export function SearchField({ value, onChange, placeholder = "Search", testID }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: sem("fillSecondary") as string, borderRadius: Radii.md },
      ]}
    >
      {t.isIOS ? (
        <SymbolView name="magnifyingglass" tintColor={sem("labelSecondary") as string} size={15} />
      ) : (
        <Feather name="search" size={15} color={sem("labelSecondary") as string} />
      )}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={sem("labelSecondary") as string}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.input, { color: sem("label") as string }]}
      />
      {value.length > 0 && !t.isIOS && (
        <Pressable onPress={() => onChange("")}>
          <Feather name="x-circle" size={16} color={sem("labelTertiary") as string} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 36,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
});
