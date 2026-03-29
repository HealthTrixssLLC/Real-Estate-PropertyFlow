import { Feather } from "@expo/vector-icons";
import {
  useGetTour,
  useMarkStopArrived,
  useMarkStopCompleted,
  getGetTourQueryKey,
} from "@workspace/api-client-react";
import type { TourStopWithAddress } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
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

function StopCard({
  stop,
  label,
  index,
  total,
  onPress,
}: {
  stop: TourStopWithAddress;
  label: "current" | "next";
  index: number;
  total: number;
  onPress: () => void;
}) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";
  const isCurrent = label === "current";
  const address = stop.formattedAddress || stop.propertyNickname || `Stop #${index + 1}`;

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
        {buyer && (
          <View style={styles.buyerRow}>
            <View style={[styles.buyerChip, { backgroundColor: C.surfaceAlt }]}>
              {isIOS ? (
                <SymbolView name="person.fill" tintColor={C.textSecondary} size={13} />
              ) : (
                <Feather name="user" size={13} color={C.textSecondary} />
              )}
              <Text style={[styles.buyerName, { color: C.textSecondary }]}>
                {(buyer as { name: string }).name}
              </Text>
            </View>
          </View>
        )}

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
          const addr = s.formattedAddress || s.propertyNickname || `Stop #${i + 1}`;
          return (
            <Pressable
              key={s.id}
              testID={`stop-row-${i}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.stopRow,
                { backgroundColor: C.surface, borderColor: C.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.stopNum, { backgroundColor: s.skipped ? C.surfaceAlt : s.visited ? C.green : C.accent }]}>
                <Text style={styles.stopNumText}>{i + 1}</Text>
              </View>
              <View style={styles.stopRowContent}>
                <Text style={[styles.stopRowAddr, { color: C.text }]} numberOfLines={1}>
                  {addr}
                </Text>
                <StatusChip status={s.approvedStatus} small />
              </View>
              <View style={styles.stopRowRight}>
                {s.skipped && (
                  <Text style={[styles.skippedLabel, { color: C.textTertiary }]}>Skipped</Text>
                )}
                {s.visited && !s.skipped && (
                  isIOS ? (
                    <SymbolView name="checkmark.circle.fill" tintColor={C.green} size={18} />
                  ) : (
                    <Feather name="check-circle" size={18} color={C.green} />
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
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_700Bold",
  },
  stopCardText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_600SemiBold",
    color: "#F5A623",
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
    fontFamily: "Inter_700Bold",
  },
  completedSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  allStopsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
    marginBottom: 10,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  stopNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopNumText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  stopRowContent: {
    flex: 1,
    gap: 4,
  },
  stopRowAddr: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  stopRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  skippedLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
