import { useListTours } from "@workspace/api-client-react";
import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand, Radii, Spacing, useTheme } from "@/theme";

/** Persistent floating bar above the tab bar shown when an active tour exists and we aren't already on it. */
export function ActiveTourBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { data } = useListTours();

  const activeTour = useMemo(
    () => (data?.tours ?? []).find((x) => x.status === "active"),
    [data]
  );

  if (!activeTour) return null;
  // Hide when already inside this tour or on its summary.
  if (pathname?.startsWith(`/tour/${activeTour.id}`)) return null;
  if (pathname?.startsWith(`/stop/`)) return null;

  const total = activeTour.stopCount ?? 0;
  const approved = activeTour.approvedCount ?? 0;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: 56 + insets.bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resume active tour ${activeTour.title}`}
        onPress={() => router.push(`/tour/${activeTour.id}`)}
        style={({ pressed }) => [
          styles.bar,
          {
            backgroundColor: Brand.teal,
            opacity: pressed ? 0.92 : 1,
            shadowColor: "#000",
          },
        ]}
      >
        <View style={styles.dot}>
          {t.isIOS ? (
            <SymbolView name="location.fill" tintColor="#FFF" size={14} />
          ) : (
            <Feather name="navigation" size={14} color="#FFF" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {activeTour.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Tour in progress · {total} stop{total === 1 ? "" : "s"}{approved > 0 ? ` · ${approved} approved` : ""}
          </Text>
        </View>
        {t.isIOS ? (
          <SymbolView name="chevron.right" tintColor="#FFFFFFCC" size={13} />
        ) : (
          <Feather name="chevron-right" size={14} color="#FFFFFFCC" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 50,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.lg,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFF", fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 1 },
});
