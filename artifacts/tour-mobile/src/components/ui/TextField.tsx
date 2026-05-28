import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { Radii, Spacing, sem } from "@/theme";

interface Props extends TextInputProps {
  label?: string;
  errorText?: string;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, errorText, style, ...rest },
  ref
) {
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={[styles.label, { color: sem("labelSecondary") as string }]}>{label}</Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={sem("labelTertiary") as string}
        {...rest}
        style={[
          styles.input,
          {
            color: sem("label") as string,
            backgroundColor: sem("fillSecondary") as string,
            borderRadius: Radii.md,
          },
          style,
        ]}
      />
      {errorText && (
        <Text style={[styles.error, { color: sem("systemRed") as string }]}>{errorText}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    fontSize: 17,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    minHeight: 44,
  },
  error: { fontSize: 13 },
});
