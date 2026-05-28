import { Feather } from "@expo/vector-icons";
import type { Tour } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Brand, Radii, Spacing, useTheme, sem } from "@/theme";

interface TourCardProps {
  tour: Tour;
  buyerName?: string;
  isActive?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const STATUS: Record<
  string,
  { dot: string; label: string; tone: keyof typeof TONE }
> = {
  active:    { dot: Brand.teal,     label: "Active",    tone: "teal" },
  published: { dot: "#0A84FF",      label: "Published", tone: "blue" },
  draft:     { dot: "#8E8E93",      label: "Draft",     tone: "gray" },
  completed: { dot: "#34C759",      label: "Completed", tone: "green" },
  cancelled: { dot: "#FF3B30",      label: "Cancelled", tone: "red" },
};

const TONE = {
  teal: Brand.teal,
  blue: "#0A84FF",
  gray: "#8E8E93",
  green: "#34C759",
  red: "#FF3B30",
};

export function TourCard({ tour, buyerName, isActive, isFirst, isLast }: TourCardProps) {
  const t = useTheme();
  const status = STATUS[tour.status] ?? STATUS.draft;

  const tourDate = new Date(tour.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(tourDate);
  d.setHours(0, 0, 0, 0);
  const sameDay = d.getTime() === today.getTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.getTime() === tomorrow.getTime();
  const dateStr = sameDay
    ? "Today"
    : isTomorrow
    ? "Tomorrow"
    : tourDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

  return (
    <Pressable
      testID="tour-card"
      accessibilityRole="button"
      accessibilityLabel={`Open tour ${tour.title}`}
      onPress={() => router.push(`/tour/${tour.id}`)}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: pressed ? (sem("fillTertiary") as string) : "transparent",
          borderTopLeftRadius: isFirst ? Radii.lg : 0,
          borderTopRightRadius: isFirst ? Radii.lg : 0,
          borderBottomLeftRadius: isLast ? Radii.lg : 0,
          borderBottomRightRadius: isLast ? Radii.lg : 0,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: status.dot }]} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: sem("label") as string }]}
            numberOfLines={1}
          >
            {tour.title}
          </Text>
          {isActive && (
            <View style={[styles.live, { backgroundColor: Brand.teal }]}>
              <View style={styles.livePulse} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        {buyerName ? (
          <Text
            style={[styles.buyer, { color: sem("labelSecondary") as string }]}
            numberOfLines={1}
          >
            {buyerName}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <MetaPill icon="calendar" label={dateStr} t={t} />
          <MetaPill
            icon="house"
            label={`${tour.stopCount ?? 0} stop${(tour.stopCount ?? 0) === 1 ? "" : "s"}`}
            t={t}
          />
          {(tour.approvedCount ?? 0) > 0 && (
            <MetaPill
              icon="checkmark.circle"
              label={`${tour.approvedCount} approved`}
              tint={TONE.green}
              t={t}
            />
          )}
          {(tour.pendingShowingsCount ?? 0) > 0 && (
            <MetaPill
              icon="clock.badge.exclamationmark"
              label={`${tour.pendingShowingsCount} pending`}
              tint="#FF9500"
              t={t}
            />
          )}
        </View>
      </View>
      {t.isIOS ? (
        <SymbolView name="chevron.right" tintColor={sem("labelTertiary") as string} size={13} />
      ) : (
        <Feather name="chevron-right" size={14} color={sem("labelTertiary") as string} />
      )}
    </Pressable>
  );
}

function MetaPill({
  icon,
  label,
  tint,
  t,
}: {
  icon: string;
  label: string;
  tint?: string;
  t: ReturnType<typeof useTheme>;
}) {
  const color = tint ?? (sem("labelSecondary") as string);
  return (
    <View style={styles.metaItem}>
      {t.isIOS ? (
        <SymbolView name={icon as any} tintColor={color} size={11} />
      ) : null}
      <Text style={[styles.metaText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 7,
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: "600", letterSpacing: -0.32 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  liveText: { color: "#FFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  buyer: { fontSize: 13 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "500", letterSpacing: -0.08 },
});
