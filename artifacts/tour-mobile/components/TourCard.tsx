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
          borderColor: isActive ? C.accent : C.border,
          borderWidth: isActive ? 1.5 : 1,
          shadowColor: C.shadow,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBadge, { backgroundColor: C.accent }]}>
          <Text style={styles.activeBadgeText}>IN PROGRESS</Text>
        </View>
      )}
      <View style={styles.header}>
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
          <Text style={[styles.buyer, { color: C.textSecondary }]}>{buyerName}</Text>
        )}
      </View>

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
            {tour.stopCount ?? 0} stops
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
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
  header: {
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  buyer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
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
