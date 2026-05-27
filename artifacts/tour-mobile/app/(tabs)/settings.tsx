import { Feather } from "@expo/vector-icons";
import { useGetCurrentAuthUser } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import React, { type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";

interface SettingsRowProps {
  label: string;
  value?: string;
  sfIcon?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  onPress?: () => void;
  danger?: boolean;
}

function SettingsRow({ label, value, sfIcon, featherIcon, onPress, danger }: SettingsRowProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";

  return (
    <Pressable
      onPress={onPress}
      testID={`settings-row-${label}`}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { opacity: 0.7 } : {},
      ]}
    >
      <View style={styles.rowLeft}>
        {sfIcon && isIOS ? (
          <SymbolView name={sfIcon} tintColor={danger ? C.coral : C.accent} size={18} />
        ) : featherIcon ? (
          <Feather name={featherIcon} size={18} color={danger ? C.coral : C.accent} />
        ) : null}
        <Text style={[styles.rowLabel, { color: danger ? C.coral : C.text }]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: C.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {onPress && (
          isIOS ? (
            <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
          ) : (
            <Feather name="chevron-right" size={14} color={C.textTertiary} />
          )
        )}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { signOut } = useAuth();
  const { data: authData } = useGetCurrentAuthUser();

  const user = authData?.user;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Agent";
  const email = user?.email ?? "";

  return (
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCard, { backgroundColor: Semantic.groupedSurface }]}>
        <View style={[styles.avatar, { backgroundColor: C.accent }]}>
          <Text style={styles.avatarInitial}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={[styles.profileName, { color: C.text }]}>{displayName}</Text>
          {email ? (
            <Text style={[styles.profileEmail, { color: C.textSecondary }]}>{email}</Text>
          ) : null}
          <Text style={[styles.profileRole, { color: C.accent }]}>
            {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Agent"}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Support</Text>
      <View style={[styles.section, { backgroundColor: Semantic.groupedSurface }]}>
        <SettingsRow
          label="Help & Guide"
          sfIcon="questionmark.circle.fill"
          featherIcon="help-circle"
          onPress={() => router.push("/help")}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>App</Text>
      <View style={[styles.section, { backgroundColor: Semantic.groupedSurface }]}>
        <SettingsRow
          label="API Connection"
          value="Connected"
          sfIcon="wifi"
          featherIcon="wifi"
        />
        <SettingsRow
          label="Offline Cache"
          value="Enabled"
          sfIcon="square.and.arrow.down"
          featherIcon="download"
        />
        <SettingsRow
          label="App Version"
          value="1.0.0"
          sfIcon="info.circle"
          featherIcon="info"
        />
      </View>

      <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Account</Text>
      <View style={[styles.section, { backgroundColor: Semantic.groupedSurface }]}>
        <SettingsRow
          label="Sign Out"
          sfIcon="rectangle.portrait.and.arrow.right"
          featherIcon="log-out"
          danger
          onPress={signOut}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: Semantic.grouped as unknown as string,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  profileName: {
    ...Typography.headline,
  },
  profileEmail: {
    ...Typography.footnote,
    marginTop: 2,
  },
  profileRole: {
    ...Typography.caption1,
    fontWeight: "500",
    marginTop: 3,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: 6,
  },
  section: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Semantic.opaqueSeparator as unknown as string,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    ...Typography.subheadline,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 160,
  },
  rowValue: {
    ...Typography.subheadline,
  },
});
