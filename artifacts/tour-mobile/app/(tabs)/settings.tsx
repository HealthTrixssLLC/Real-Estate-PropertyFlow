import { useGetCurrentAuthUser } from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListGroup, ListRow, ScreenHeader, SyncStatusPill } from "@/components/ui";
import { Brand, Radii, Spacing, sem } from "@/theme";
import { useAuth } from "@/context/AuthContext";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data: authData } = useGetCurrentAuthUser();

  const user = authData?.user;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Agent";
  const email = user?.email ?? "";

  const handleSignOut = () => {
    Alert.alert("Sign out", "You'll need to sign in again to access your tours.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: sem("grouped") as string }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Settings" right={<SyncStatusPill />} />

      <View
        style={[
          styles.profile,
          {
            backgroundColor: sem("groupedSurface") as string,
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.xl,
            borderRadius: Radii.lg,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: Brand.teal }]}>
          <Text style={styles.avatarInitial}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: sem("label") as string }]}>
            {displayName}
          </Text>
          {email ? (
            <Text style={[styles.profileEmail, { color: sem("labelSecondary") as string }]}>
              {email}
            </Text>
          ) : null}
          <View style={[styles.roleChip, { backgroundColor: Brand.teal + "1F" }]}>
            <Text style={[styles.roleText, { color: Brand.teal }]}>
              {user?.role ? user.role.toUpperCase() : "AGENT"}
            </Text>
          </View>
        </View>
      </View>

      <ListGroup header="Support">
        <ListRow
          title="Help & Quick Guide"
          sfSymbol="questionmark.circle.fill"
          featherIcon="help-circle"
          iconBg={Brand.teal + "1F"}
          iconColor={Brand.teal}
          onPress={() => router.push("/help")}
          isFirst
          isLast
        />
      </ListGroup>

      <ListGroup header="App">
        <ListRow
          title="Connection"
          value="Auto-sync"
          sfSymbol="wifi"
          featherIcon="wifi"
          iconBg="#0A84FF1F"
          iconColor="#0A84FF"
          accessory="none"
          isFirst
        />
        <ListRow
          title="Offline cache"
          value="Enabled"
          sfSymbol="square.and.arrow.down.fill"
          featherIcon="download"
          iconBg="#5856D61F"
          iconColor="#5856D6"
          accessory="none"
        />
        <ListRow
          title="Version"
          value="1.0.0"
          sfSymbol="info.circle.fill"
          featherIcon="info"
          iconBg={(sem("fillTertiary") as string)}
          iconColor={sem("labelSecondary") as string}
          accessory="none"
          isLast
        />
      </ListGroup>

      <ListGroup header="Account">
        <ListRow
          title="Sign out"
          sfSymbol="rectangle.portrait.and.arrow.right"
          featherIcon="log-out"
          iconBg="#FF3B301F"
          iconColor="#FF3B30"
          destructive
          accessory="none"
          onPress={handleSignOut}
          isFirst
          isLast
        />
      </ListGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  profileName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  profileEmail: { fontSize: 14, marginTop: 2 },
  roleChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
});
