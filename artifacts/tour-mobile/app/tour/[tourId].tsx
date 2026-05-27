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
import { DebriefSheet } from "@/components/DebriefSheet";
import { StatusChip } from "@/components/StatusChip";
import { StopProgressBar } from "@/components/StopProgressBar";
import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";
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

function FitScoreBadge({ score, predicted }: { score: number; predicted?: boolean }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const bg = score >= 75 ? C.green : score >= 50 ? C.amber : C.coral;
  return (
    <View style={[fitScoreStyles.pill, { backgroundColor: bg + "22", borderColor: bg + "44" }]}>
      <Text style={[fitScoreStyles.label, { color: bg }]}>
        {predicted ? `~${score}` : `${score}`}
      </Text>
      <Text style={[fitScoreStyles.sub, { color: bg }]}>{predicted ? " pred." : "/100"}</Text>
    </View>
  );
}

const fitScoreStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    marginLeft: 6,
  },
  label: { fontSize: 11, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 9, fontFamily: "Inter_500Medium" },
});

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
        isCurrent
          ? { backgroundColor: C.primary }
          : { backgroundColor: Semantic.groupedSurface as unknown as string },
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
            <SymbolView name="exclamationmark.triangle.fill" tintColor={Semantic.systemOrange as unknown as string} size={12} />
          ) : (
            <Feather name="alert-triangle" size={12} color={Semantic.systemOrange as unknown as string} />
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
              <SymbolView name="bookmark.fill" tintColor={Semantic.systemOrange as unknown as string} size={12} />
            ) : (
              <Feather name="bookmark" size={12} color={Semantic.systemOrange as unknown as string} />
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

  // Debrief sheet state
  const [debriefStopId, setDebriefStopId] = useState<string | null>(null);

  const { mutate: arriveAtStop, isPending: isArriving } = useMarkStopArrived({
    mutation: { onSuccess: () => refetch() },
  });
  const { mutate: completeStop, isPending: isCompleting } = useMarkStopCompleted({
    mutation: {
      onSuccess: (_, variables) => {
        refetch();
        // Prompt for debrief after completing a stop
        const completedStopId = variables.stopId;
        setDebriefStopId(completedStopId);
      },
    },
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
        data: { buyerId: buyerId ?? undefined },
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
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={styles.center}>
        <Text style={{ color: C.textSecondary }}>Tour not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollBg}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
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
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setBuyerPickerOpen(false)} style={styles.pickerClose}>
                <Text style={[styles.pickerCloseText, { color: C.accent }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.pickerTitle, { color: C.text }]}>Assign Buyer</Text>
              <View style={styles.pickerClose} />
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              <View style={styles.pickerGroup}>
                <Pressable
                  onPress={() => handleAssignBuyer(null)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    styles.pickerRowDivider,
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
                {(buyersData?.buyers ?? []).map((b, bi, arr) => (
                  <Pressable
                    key={b.id}
                    onPress={() => handleAssignBuyer(b.id)}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      bi < arr.length - 1 && styles.pickerRowDivider,
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
              </View>
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
          <View style={styles.completedBanner}>
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

        <Text style={[styles.allStopsTitle, { color: C.textSecondary }]}>All stops</Text>
        <View style={styles.stopsGroup}>
        {stops.map((s, i) => {
          const primaryLabel = s.propertyNickname ?? s.formattedAddress ?? `Stop ${i + 1}`;
          const secondaryLabel =
            s.propertyNickname && s.formattedAddress && s.propertyNickname !== s.formattedAddress
              ? s.formattedAddress
              : null;
          const numBg = s.skipped ? (Semantic.fillSecondary as unknown as string) : s.visited ? C.green : C.accent;
          const numColor = s.skipped ? C.textTertiary : "#FFF";
          return (
            <Pressable
              key={s.id}
              testID={`stop-row-${i}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.stopRow,
                i < stops.length - 1 && styles.stopRowDivider,
                s.skipped && { opacity: 0.55 },
                pressed && { backgroundColor: Semantic.fillTertiary as unknown as string },
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
                  {!s.visited && !s.skipped && s.predictedFitScore != null && (
                    <FitScoreBadge score={s.predictedFitScore} predicted />
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
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {actionButtons.length > 0 && <ActionTray buttons={actionButtons} />}

      {debriefStopId && (
        <DebriefSheet
          stopId={debriefStopId}
          onClose={() => {
            setDebriefStopId(null);
            refetch();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Semantic.background as unknown as string },
  scrollBg: { backgroundColor: Semantic.grouped as unknown as string },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Semantic.background as unknown as string },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
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
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  restrictionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(245,166,35,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  restrictionText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#F5A623",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  etaText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  stopCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  visitedBadge: {
    backgroundColor: "rgba(52,199,89,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visitedText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#34C759",
  },
  flagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flagText: {
    fontSize: 11,
    fontWeight: "600",
    color: Semantic.systemOrange as unknown as string,
  },
  completedBanner: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  completedTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  completedSub: {
    fontSize: 14,
  },
  allStopsTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  stopRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Semantic.opaqueSeparator as unknown as string,
  },
  stopNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stopNumText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  stopRowContent: {
    flex: 1,
    gap: 3,
  },
  stopRowAddr: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  stopRowSubAddr: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  stopRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  skippedLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  stopRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Semantic.opaqueSeparator as unknown as string,
    backgroundColor: Semantic.surface as unknown as string,
  },
  pickerClose: { width: 64 },
  pickerCloseText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pickerTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  pickerList: { padding: 16, gap: 10 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerRowText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
