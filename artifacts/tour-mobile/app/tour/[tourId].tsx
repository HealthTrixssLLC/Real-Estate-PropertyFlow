import { Feather } from "@expo/vector-icons";
import {
  useGetTour,
  useMarkStopArrived,
  useMarkStopCompleted,
  useUpdateTour,
  useListBuyers,
  getGetTourQueryKey,
} from "@workspace/api-client-react";
import type { TourStopWithAddress } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionTray } from "@/components/ActionTray";
import type { ActionButton } from "@/components/ActionTray";
import { StatusChip } from "@/components/StatusChip";
import { StopProgressBar } from "@/components/StopProgressBar";
import Colors from "@/constants/colors";
import { useTourContext } from "@/context/TourContext";

const RESTRICTED_STATUSES = new Set(["restricted", "declined", "needs_follow_up"]);

function haversineMinutes(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const distMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(distMiles / 30 * 60));
}

function StopCard({
  stop,
  label,
  index,
  total,
  nextStop,
  onPress,
}: {
  stop: TourStopWithAddress;
  label: "current" | "next";
  index: number;
  total: number;
  nextStop?: TourStopWithAddress | null;
  onPress: () => void;
}) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";
  const isCurrent = label === "current";
  const address = stop.propertyNickname || stop.formattedAddress || `Stop ${index + 1}`;
  const hasRestriction = RESTRICTED_STATUSES.has(stop.approvedStatus);

  const etaMinutes: number | null =
    isCurrent && nextStop &&
    stop.lat != null && stop.lng != null &&
    nextStop.lat != null && nextStop.lng != null
      ? haversineMinutes(stop.lat, stop.lng, nextStop.lat, nextStop.lng)
      : null;

  return (
    <Pressable
      testID={`stop-card-${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stopCard,
        {
          backgroundColor: isCurrent ? C.primary : C.surface,
          borderColor: isCurrent ? "transparent" : C.border,
          borderWidth: isCurrent ? 0 : 1,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.stopCardHeader}>
        <Text
          style={[
            styles.stopCardLabel,
            { color: isCurrent ? "rgba(255,255,255,0.6)" : C.textSecondary },
          ]}
        >
          {isCurrent ? "CURRENT STOP" : "NEXT UP"} · {index + 1}/{total}
        </Text>
        <StatusChip
          status={stop.approvedStatus}
          small
        />
      </View>
      <View style={styles.stopCardRow}>
        <View style={styles.stopCardAddress}>
          <Text
            style={[
              styles.stopCardNum,
              { color: isCurrent ? C.accent : C.accent },
            ]}
          >
            #{index + 1}
          </Text>
          {isIOS ? (
            <SymbolView
              name="chevron.right"
              tintColor={isCurrent ? "rgba(255,255,255,0.5)" : C.textTertiary}
              size={14}
            />
          ) : (
            <Feather
              name="chevron-right"
              size={14}
              color={isCurrent ? "rgba(255,255,255,0.5)" : C.textTertiary}
            />
          )}
        </View>
        <Text
          style={[
            styles.stopCardText,
            { color: isCurrent ? "#FFFFFF" : C.text },
          ]}
          numberOfLines={2}
        >
          {address}
        </Text>
      </View>
      {hasRestriction && isCurrent && (
        <View style={styles.restrictionBanner}>
          {isIOS ? (
            <SymbolView name="exclamationmark.triangle.fill" tintColor="#F5A623" size={12} />
          ) : (
            <Feather name="alert-triangle" size={12} color="#F5A623" />
          )}
          <Text style={styles.restrictionText}>
            {stop.approvedStatus === "restricted"
              ? "Access restricted — confirm entry requirements"
              : stop.approvedStatus === "declined"
              ? "Showing declined"
              : "Needs follow-up with listing agent"}
          </Text>
        </View>
      )}
      {stop.quickTags && stop.quickTags.length > 0 && (
        <View style={styles.tagsRow}>
          {stop.quickTags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={[styles.tagPill, { backgroundColor: isCurrent ? "rgba(255,255,255,0.15)" : C.surfaceAlt }]}
            >
              <Text style={[styles.tagText, { color: isCurrent ? "rgba(255,255,255,0.85)" : C.textSecondary }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}
      {isCurrent && nextStop && (
        <View style={styles.etaRow}>
          {isIOS ? (
            <SymbolView name="arrow.turn.up.right" tintColor={C.accent} size={12} />
          ) : (
            <Feather name="corner-up-right" size={12} color={C.accent} />
          )}
          <Text style={styles.etaText} numberOfLines={1}>
            {etaMinutes != null
              ? `~${etaMinutes} min to next stop`
              : `Next: ${nextStop.propertyNickname || nextStop.formattedAddress || `Stop ${index + 2}`}`}
          </Text>
        </View>
      )}
      <View style={styles.stopCardFooter}>
        {stop.visited && (
          <View style={styles.visitedBadge}>
            <Text style={styles.visitedText}>Visited</Text>
          </View>
        )}
        {stop.followUpFlag && (
          <View style={[styles.flagBadge, { backgroundColor: isCurrent ? "rgba(245,166,35,0.2)" : C.surfaceAlt }]}>
            {isIOS ? (
              <SymbolView name="bookmark.fill" tintColor="#F5A623" size={12} />
            ) : (
              <Feather name="bookmark" size={12} color="#F5A623" />
            )}
            <Text style={styles.flagText}>Follow Up</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

async function openNavigation(address: string) {
  const encoded = encodeURIComponent(address);
  if (Platform.OS === "ios") {
    const googleUrl = `comgooglemaps://?daddr=${encoded}&directionsmode=driving`;
    const canOpenGoogle = await Linking.canOpenURL(googleUrl);
    if (canOpenGoogle) {
      await Linking.openURL(googleUrl);
    } else {
      await Linking.openURL(`maps://?q=${encoded}`);
    }
  } else {
    await Linking.openURL(`https://maps.google.com/?q=${encoded}`);
  }
}

export default function ActiveTourScreen() {
  const { tourId } = useLocalSearchParams<{ tourId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const navigation = useNavigation();

  const { cachedTours, cacheTourDetail } = useTourContext();
  const cachedData = tourId ? cachedTours[tourId] : undefined;

  const { data: liveData, isLoading, refetch } = useGetTour(tourId ?? "", {
    query: { queryKey: getGetTourQueryKey(tourId ?? ""), enabled: !!tourId },
  });

  const data = liveData ?? cachedData;

  useEffect(() => {
    if (liveData) cacheTourDetail(liveData);
  }, [liveData, cacheTourDetail]);

  const tour = data?.tour;
  const stops: TourStopWithAddress[] = data?.stops ?? [];
  const buyer = data?.buyer;

  const activeStops = useMemo(
    () => stops.filter((s) => !s.skipped).sort((a, b) => a.sequence - b.sequence),
    [stops]
  );

  const currentStop = activeStops.find((s) => !s.visited) ?? null;
  const currentIdx = currentStop ? activeStops.indexOf(currentStop) : activeStops.length;
  const nextStop = activeStops[currentIdx + 1] ?? null;

  const visitedCount = stops.filter((s) => s.visited).length;
  const skippedCount = stops.filter((s) => s.skipped).length;

  const { mutate: arriveAtStop, isPending: isArriving } = useMarkStopArrived({
    mutation: { onSuccess: () => refetch() },
  });
  const { mutate: completeStop, isPending: isCompleting } = useMarkStopCompleted({
    mutation: { onSuccess: () => refetch() },
  });

  const { mutate: updateTour } = useUpdateTour({
    mutation: { onSuccess: () => refetch() },
  });
  const { data: buyersData } = useListBuyers();
  const [buyerPickerOpen, setBuyerPickerOpen] = useState(false);

  const handleAssignBuyer = (buyerId: string | null) => {
    if (!tourId) return;
    updateTour(
      {
        tourId,
        data: { buyerId: buyerId },
      },
      {
        onSuccess: () => {
          refetch();
          setBuyerPickerOpen(false);
        },
        onError: () => {
          Alert.alert("Error", "Failed to update buyer. Please try again.");
        },
      }
    );
  };

  useEffect(() => {
    if (tour) {
      navigation.setOptions({ title: tour.title });
    }
  }, [tour, navigation]);

  const handleArrive = () => {
    if (!currentStop) return;
    Alert.alert("Mark Arrived", "Confirm you have arrived at this stop?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Arrived",
        onPress: () => {
          arriveAtStop({ stopId: currentStop.id });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleComplete = () => {
    if (!currentStop) return;
    Alert.alert("Complete Showing", "Mark this showing as complete?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: () => {
          completeStop({ stopId: currentStop.id });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleSkip = () => {
    if (!currentStop) return;
    router.push({
      pathname: "/skip-stop",
      params: { stopId: currentStop.id, tourId: tourId ?? "" },
    });
  };

  const handleEndTour = () => {
    router.push(`/tour/${tourId}/summary`);
  };

  const actionButtons: ActionButton[] = [];

  if (currentStop && !currentStop.visited) {
    if (!currentStop.arrivalTime) {
      actionButtons.push({
        id: "navigate",
        label: "Navigate",
        sfIcon: "arrow.triangle.turn.up.right.circle.fill",
        featherIcon: "navigation",
        onPress: () => {
          const addr = currentStop.formattedAddress || currentStop.propertyNickname || "";
          if (addr) openNavigation(addr);
        },
      });
      actionButtons.push({
        id: "details",
        label: "View Details",
        sfIcon: "doc.text",
        featherIcon: "file-text",
        onPress: () => router.push(`/stop/${currentStop.id}`),
      });
      actionButtons.push({
        id: "skip",
        label: "Skip",
        sfIcon: "forward.fill",
        featherIcon: "skip-forward",
        danger: true,
        onPress: handleSkip,
      });
      actionButtons.push({
        id: "arrive",
        label: "Mark Arrived",
        sfIcon: "mappin.circle.fill",
        featherIcon: "map-pin",
        primary: true,
        loading: isArriving,
        onPress: handleArrive,
      });
    } else {
      actionButtons.push({
        id: "details",
        label: "View Details",
        sfIcon: "doc.text",
        featherIcon: "file-text",
        onPress: () => router.push(`/stop/${currentStop.id}`),
      });
      actionButtons.push({
        id: "skip",
        label: "Skip",
        sfIcon: "forward.fill",
        featherIcon: "skip-forward",
        danger: true,
        onPress: handleSkip,
      });
      actionButtons.push({
        id: "complete",
        label: "Complete Showing",
        sfIcon: "checkmark.circle.fill",
        featherIcon: "check-circle",
        primary: true,
        loading: isCompleting,
        onPress: handleComplete,
      });
      actionButtons.push({
        id: "record",
        label: "Record Note",
        sfIcon: "mic.fill",
        featherIcon: "mic",
        onPress: () => router.push(`/stop/${currentStop.id}`),
      });
    }
  }

  if (visitedCount > 0 || skippedCount > 0) {
    actionButtons.push({
      id: "end",
      label: "Tour Summary",
      sfIcon: "flag.checkered",
      featherIcon: "flag",
      onPress: handleEndTour,
    });
  }

  if (isLoading && !data) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>Tour not found.</Text>
      </View>
    );
  }

  const topPad = isWeb ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => setBuyerPickerOpen(true)}
          style={({ pressed }) => [styles.buyerRow, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.buyerChip, { backgroundColor: C.surfaceAlt }]}>
            {isIOS ? (
              <SymbolView name="person.fill" tintColor={C.textSecondary} size={13} />
            ) : (
              <Feather name="user" size={13} color={C.textSecondary} />
            )}
            <Text style={[styles.buyerName, { color: C.textSecondary }]}>
              {buyer ? (buyer as { name: string }).name : "Assign buyer…"}
            </Text>
            {isIOS ? (
              <SymbolView name="chevron.down" tintColor={C.textTertiary} size={11} />
            ) : (
              <Feather name="chevron-down" size={11} color={C.textTertiary} />
            )}
          </View>
        </Pressable>

        <Modal
          visible={buyerPickerOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setBuyerPickerOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: C.background }}>
            <View style={[styles.pickerHeader, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
              <Pressable onPress={() => setBuyerPickerOpen(false)} style={styles.pickerClose}>
                <Text style={[styles.pickerCloseText, { color: C.accent }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.pickerTitle, { color: C.text }]}>Assign Buyer</Text>
              <View style={styles.pickerClose} />
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              <Pressable
                onPress={() => handleAssignBuyer(null)}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { backgroundColor: C.surface, borderColor: C.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pickerRowText, { color: C.textSecondary }]}>No buyer (unassign)</Text>
                {!tour.buyerId && (
                  isIOS ? (
                    <SymbolView name="checkmark" tintColor={C.accent} size={16} />
                  ) : (
                    <Feather name="check" size={16} color={C.accent} />
                  )
                )}
              </Pressable>
              {(buyersData?.buyers ?? []).map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => handleAssignBuyer(b.id)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    { backgroundColor: C.surface, borderColor: C.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.pickerRowText, { color: C.text }]}>{b.name}</Text>
                  {tour.buyerId === b.id && (
                    isIOS ? (
                      <SymbolView name="checkmark" tintColor={C.accent} size={16} />
                    ) : (
                      <Feather name="check" size={16} color={C.accent} />
                    )
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Modal>

        <View style={styles.progressSection}>
          <StopProgressBar
            total={activeStops.length}
            visited={visitedCount}
            skipped={skippedCount}
          />
        </View>

        {currentStop && (
          <StopCard
            stop={currentStop}
            label="current"
            index={currentIdx}
            total={activeStops.length}
            nextStop={nextStop}
            onPress={() => router.push(`/stop/${currentStop.id}`)}
          />
        )}

        {nextStop && (
          <StopCard
            stop={nextStop}
            label="next"
            index={currentIdx + 1}
            total={activeStops.length}
            onPress={() => router.push(`/stop/${nextStop.id}`)}
          />
        )}

        {!currentStop && visitedCount > 0 && (
          <View style={[styles.completedBanner, { backgroundColor: C.surfaceAlt }]}>
            {isIOS ? (
              <SymbolView name="checkmark.seal.fill" tintColor={C.green} size={36} />
            ) : (
              <Feather name="check-circle" size={36} color={C.green} />
            )}
            <Text style={[styles.completedTitle, { color: C.text }]}>
              All stops visited!
            </Text>
            <Text style={[styles.completedSub, { color: C.textSecondary }]}>
              Tap "Tour Summary" to wrap up
            </Text>
          </View>
        )}

        <Text style={[styles.allStopsTitle, { color: C.text }]}>All Stops</Text>
        {stops.map((s, i) => {
          const primaryLabel = s.propertyNickname ?? s.formattedAddress ?? `Stop ${i + 1}`;
          const secondaryLabel =
            s.propertyNickname && s.formattedAddress && s.propertyNickname !== s.formattedAddress
              ? s.formattedAddress
              : null;
          const numBg = s.skipped ? C.surfaceAlt : s.visited ? C.green : C.accent;
          const numColor = s.skipped ? C.textTertiary : "#FFF";
          return (
            <Pressable
              key={s.id}
              testID={`stop-row-${i}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.stopRow,
                { backgroundColor: C.surface, borderColor: C.border },
                s.skipped && { opacity: 0.55 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.stopNum, { backgroundColor: numBg }]}>
                <Text style={[styles.stopNumText, { color: numColor }]}>{s.sequence + 1}</Text>
              </View>
              <View style={styles.stopRowContent}>
                <Text
                  style={[styles.stopRowAddr, { color: s.skipped ? C.textSecondary : C.text }]}
                  numberOfLines={2}
                >
                  {primaryLabel}
                </Text>
                {secondaryLabel && (
                  <Text
                    style={[styles.stopRowSubAddr, { color: C.textTertiary }]}
                    numberOfLines={1}
                  >
                    {secondaryLabel}
                  </Text>
                )}
                <View style={styles.stopRowMeta}>
                  <StatusChip status={s.approvedStatus} small />
                  {s.skipped && (
                    <Text style={[styles.skippedLabel, { color: C.textTertiary }]}>
                      · Skipped
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.stopRowRight}>
                {s.visited && !s.skipped && (
                  isIOS ? (
                    <SymbolView name="checkmark.circle.fill" tintColor={C.green} size={20} />
                  ) : (
                    <Feather name="check-circle" size={20} color={C.green} />
                  )
                )}
                {isIOS ? (
                  <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
                ) : (
                  <Feather name="chevron-right" size={14} color={C.textTertiary} />
                )}
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {actionButtons.length > 0 && <ActionTray buttons={actionButtons} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20 },
  buyerRow: { marginBottom: 12 },
  buyerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  buyerName: {
    fontSize: 13,
    fontWeight: "500",
  },
  progressSection: { marginBottom: 16 },
  stopCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  stopCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  stopCardLabel: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  stopCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stopCardAddress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  stopCardNum: {
    fontSize: 16,
    fontWeight: "bold",
  },
  stopCardText: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
  },
  stopCardFooter: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  visitedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(39,192,107,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  visitedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#27C06B",
  },
  flagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F5A623",
  },
  restrictionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(245,166,35,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  restrictionText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#F5A623",
    flex: 1,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  etaText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    flex: 1,
  },
  completedBanner: {
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  completedSub: {
    fontSize: 14,
  },
  allStopsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 10,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    minHeight: 60,
  },
  stopNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopNumText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  stopRowContent: {
    flex: 1,
    gap: 3,
  },
  stopRowAddr: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 19,
  },
  stopRowSubAddr: {
    fontSize: 12,
  },
  stopRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  stopRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  skippedLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerClose: { minWidth: 70 },
  pickerCloseText: {
    fontSize: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  pickerList: {
    padding: 16,
    gap: 8,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerRowText: {
    fontSize: 15,
  },
});
