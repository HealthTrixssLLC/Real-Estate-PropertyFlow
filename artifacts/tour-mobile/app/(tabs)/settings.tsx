import { Feather } from "@expo/vector-icons";
import { useGetCurrentAuthUser } from "@workspace/api-client-react";
import { SymbolView, type SFSymbol } from "expo-symbols";
import React from "react";
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
import { useAuth } from "@/context/AuthContext";

interface SettingsRowProps {
  label: string;
  value?: string;
  sfIcon?: SFSymbol;
  featherIcon?: string;
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
        { borderBottomColor: C.border },
        pressed && onPress ? { opacity: 0.7 } : {},
      ]}
    >
      <View style={styles.rowLeft}>
        {sfIcon && isIOS ? (
          <SymbolView name={sfIcon} tintColor={danger ? C.coral : C.accent} size={18} />
        ) : featherIcon ? (
          <Feather name={featherIcon as any} size={18} color={danger ? C.coral : C.accent} />
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
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { signOut } = useAuth();
  const { data: authData } = useGetCurrentAuthUser();

  const user = authData?.user;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Agent";
  const email = user?.email ?? "";

  const topPad = isWeb ? 67 : insets.top;

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 8, paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: C.text }]}>Settings</Text>

      <View style={[styles.profileCard, { backgroundColor: C.card, borderColor: C.border }]}>
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

      <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>App</Text>
      <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
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
      <View style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}>
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
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
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
    fontFamily: "Inter_700Bold",
  },
  profileName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  profileRole: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
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
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 160,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
