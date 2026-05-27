import { Feather } from "@expo/vector-icons";
import type { Tour } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

import { StatusChip } from "@/components/StatusChip";
import Colors from "@/constants/colors";

interface TourCardProps {
  tour: Tour;
  buyerName?: string;
  isActive?: boolean;
}

const STATUS_ACCENT: Record<string, string> = {
  active: "#2DB8A0",
  published: "#2A73C8",
  draft: "#A0ADB8",
  completed: "#27C06B",
  cancelled: "#E85D4A",
};

export function TourCard({ tour, buyerName, isActive }: TourCardProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";

  const tourDate = new Date(tour.date);
  const dateStr = tourDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const accentColor = STATUS_ACCENT[tour.status] ?? C.accent;

  const handlePress = () => {
    router.push(`/tour/${tour.id}`);
  };

  return (
    <Pressable
      testID="tour-card"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: C.card,
          borderColor: C.border,
          shadowColor: C.shadow,
        },
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {isActive && (
          <View style={[styles.activeBadge, { backgroundColor: C.accent }]}>
            <Text style={styles.activeBadgeText}>IN PROGRESS</Text>
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>
            {tour.title}
          </Text>
          {isIOS ? (
            <SymbolView name="chevron.right" tintColor={C.textTertiary} size={16} />
          ) : (
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          )}
        </View>

        {buyerName && (
          <Text style={[styles.buyer, { color: C.textSecondary }]} numberOfLines={1}>
            {buyerName}
          </Text>
        )}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            {isIOS ? (
              <SymbolView name="calendar" tintColor={C.textTertiary} size={13} />
            ) : (
              <Feather name="calendar" size={13} color={C.textTertiary} />
            )}
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{dateStr}</Text>
          </View>
          <View style={styles.metaItem}>
            {isIOS ? (
              <SymbolView name="house" tintColor={C.textTertiary} size={13} />
            ) : (
              <Feather name="home" size={13} color={C.textTertiary} />
            )}
            <Text style={[styles.metaText, { color: C.textSecondary }]}>
              {tour.stopCount ?? 0} stop{(tour.stopCount ?? 0) !== 1 ? "s" : ""}
            </Text>
          </View>
          {(tour.approvedCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              {isIOS ? (
                <SymbolView name="checkmark.circle" tintColor="#27C06B" size={13} />
              ) : (
                <Feather name="check-circle" size={13} color="#27C06B" />
              )}
              <Text style={[styles.metaText, { color: "#27C06B" }]}>
                {tour.approvedCount} approved
              </Text>
            </View>
          )}
          {(tour.pendingShowingsCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              {isIOS ? (
                <SymbolView name="clock.badge.exclamationmark" tintColor="#F5A623" size={13} />
              ) : (
                <Feather name="alert-circle" size={13} color="#F5A623" />
              )}
              <Text style={[styles.metaText, { color: "#F5A623" }]}>
                {tour.pendingShowingsCount} pending
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <StatusChip status={tour.status} small />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  body: {
    flex: 1,
    padding: 11,
    paddingLeft: 11,
  },
  activeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  buyer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
