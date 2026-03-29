import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";

import Colors from "@/constants/colors";

type ChipVariant =
  | "active"
  | "draft"
  | "published"
  | "completed"
  | "cancelled"
  | "approved"
  | "pending"
  | "requested"
  | "not_requested"
  | "declined"
  | "needs_follow_up"
  | "restricted";

interface StatusChipProps {
  status: ChipVariant;
  label?: string;
  small?: boolean;
}

const TOUR_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  published: "Published",
  completed: "Completed",
  cancelled: "Cancelled",
};

const SHOWING_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  requested: "Requested",
  not_requested: "No Request",
  declined: "Declined",
  needs_follow_up: "Follow Up",
  restricted: "Restricted",
  cancelled: "Cancelled",
};

export function StatusChip({ status, label, small = false }: StatusChipProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];

  const tourChip = C.chip[status as keyof typeof C.chip];
  const approvedChip = C.approvedStatus[status as keyof typeof C.approvedStatus];
  const chip = tourChip ?? approvedChip ?? { bg: C.surfaceAlt, text: C.textSecondary };

  const displayLabel = label ?? TOUR_LABELS[status] ?? SHOWING_LABELS[status] ?? status;

  return (
    <View style={[styles.chip, { backgroundColor: chip.bg }, small && styles.small]}>
      <Text style={[styles.label, { color: chip.text }, small && styles.smallLabel]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smallLabel: {
    fontSize: 10,
  },
});
