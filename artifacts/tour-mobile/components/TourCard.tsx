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

const STATUS_DOT: Record<string, string> = {
  active: "#2DB8A0",
  published: "#007AFF",
  draft: "#AEAEB2",
  completed: "#34C759",
  cancelled: "#FF3B30",
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

  const dotColor = STATUS_DOT[tour.status] ?? C.accent;

  return (
    <Pressable
      testID="tour-card"
      onPress={() => router.push(`/tour/${tour.id}`)}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: C.surface, borderBottomColor: C.border },
        pressed && { backgroundColor: C.surfaceAlt },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />

      <View style={styles.body}>
        {isActive && (
          <View style={[styles.activeBadge, { backgroundColor: C.accent + "20" }]}>
            <Text style={[styles.activeBadgeText, { color: C.accent }]}>IN PROGRESS</Text>
          </View>
        )}

        <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>
          {tour.title}
        </Text>

        {buyerName && (
          <Text style={[styles.buyer, { color: C.textSecondary }]} numberOfLines={1}>
            {buyerName}
          </Text>
        )}

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            {isIOS ? (
              <SymbolView name="calendar" tintColor={C.textTertiary} size={12} />
            ) : (
              <Feather name="calendar" size={12} color={C.textTertiary} />
            )}
            <Text style={[styles.metaText, { color: C.textSecondary }]}>{dateStr}</Text>
          </View>
          <View style={styles.metaItem}>
            {isIOS ? (
              <SymbolView name="house" tintColor={C.textTertiary} size={12} />
            ) : (
              <Feather name="home" size={12} color={C.textTertiary} />
            )}
            <Text style={[styles.metaText, { color: C.textSecondary }]}>
              {tour.stopCount ?? 0} stop{(tour.stopCount ?? 0) !== 1 ? "s" : ""}
            </Text>
          </View>
          {(tour.approvedCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              {isIOS ? (
                <SymbolView name="checkmark.circle" tintColor={C.green} size={12} />
              ) : (
                <Feather name="check-circle" size={12} color={C.green} />
              )}
              <Text style={[styles.metaText, { color: C.green }]}>
                {tour.approvedCount} approved
              </Text>
            </View>
          )}
          {(tour.pendingShowingsCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              {isIOS ? (
                <SymbolView name="clock.badge.exclamationmark" tintColor={C.amber} size={12} />
              ) : (
                <Feather name="alert-circle" size={12} color={C.amber} />
              )}
              <Text style={[styles.metaText, { color: C.amber }]}>
                {tour.pendingShowingsCount} pending
              </Text>
            </View>
          )}
        </View>

        <StatusChip status={tour.status} small />
      </View>

      <View style={styles.chevron}>
        {isIOS ? (
          <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
        ) : (
          <Feather name="chevron-right" size={14} color={C.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    flexShrink: 0,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  body: {
    flex: 1,
    gap: 3,
  },
  activeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 3,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  buyer: {
    fontSize: 13,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 12,
  },
  chevron: {
    marginLeft: 8,
    flexShrink: 0,
  },
});
