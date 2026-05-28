import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { Brand, Radii, Spacing, useTheme, sem } from "@/theme";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    if (!username.trim()) {
      setError("Enter your username");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: sem("background") as string }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          flexGrow: 1,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: Brand.teal }]}>
            {t.isIOS ? (
              <SymbolView name="map.fill" tintColor="#FFFFFF" size={40} />
            ) : (
              <Feather name="map" size={36} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.appName, { color: sem("label") as string }]}>TourFlow</Text>
          <Text style={[styles.tagline, { color: sem("labelSecondary") as string }]}>
            Run the perfect tour, in your pocket
          </Text>
        </View>

        <View style={{ gap: Spacing.md }}>
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            editable={!loading}
            testID="login-username"
          />
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: sem("labelSecondary") as string }]}>
              Password
            </Text>
            <View
              style={[
                styles.passwordWrap,
                { backgroundColor: sem("fillSecondary") as string, borderRadius: Radii.md },
              ]}
            >
              <TextInputSecure
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                onSubmitEditing={handleSignIn}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                {t.isIOS ? (
                  <SymbolView
                    name={showPassword ? "eye.slash.fill" : "eye.fill"}
                    tintColor={sem("labelSecondary") as string}
                    size={18}
                  />
                ) : (
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={sem("labelSecondary") as string}
                  />
                )}
              </Pressable>
            </View>
          </View>

          {error && (
            <View
              style={[
                styles.errBox,
                { backgroundColor: "#FF3B301F", borderColor: "#FF3B3055" },
              ]}
            >
              {t.isIOS ? (
                <SymbolView name="exclamationmark.circle.fill" tintColor="#FF3B30" size={14} />
              ) : (
                <Feather name="alert-circle" size={14} color="#FF3B30" />
              )}
              <Text style={styles.errText}>{error}</Text>
            </View>
          )}

          <View style={{ marginTop: Spacing.md }}>
            <Button
              label="Sign in"
              onPress={handleSignIn}
              loading={loading}
              size="lg"
              fullWidth
              haptic="medium"
              testID="login-submit"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Inline secure-text input that fits inside our combo container.
function TextInputSecure(props: {
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry: boolean;
  editable: boolean;
  onSubmitEditing: () => void;
}) {
  // Local import to keep file lean.
  const { TextInput } = require("react-native");
  return (
    <TextInput
      style={[
        { flex: 1, fontSize: 17, color: sem("label") as unknown as string, paddingVertical: 11 },
      ]}
      placeholder="••••••••"
      placeholderTextColor={sem("labelTertiary") as string}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="current-password"
      returnKeyType="done"
      {...props}
      testID="login-password"
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 36, gap: 12 },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Brand.teal,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  appName: { fontSize: 34, fontWeight: "800", letterSpacing: -0.6 },
  tagline: { fontSize: 16, textAlign: "center" },
  label: { fontSize: 13, fontWeight: "500" },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    gap: Spacing.sm,
  },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  errText: { color: "#FF3B30", fontSize: 13, flex: 1, fontWeight: "500" },
});
