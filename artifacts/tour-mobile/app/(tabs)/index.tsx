import { Feather } from "@expo/vector-icons";
import { useListTours, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TourCard } from "@/components/TourCard";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import Colors from "@/constants/colors";

export default function TodayScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const { data: authData } = useGetCurrentAuthUser();
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useListTours();

  const tours = data?.tours ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTours = tours.filter((t) => {
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const activeTour = todayTours.find((t) => t.status === "active");
  const nonCompletedTours = todayTours.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completedToday = todayTours.filter((t) => t.status === "completed");
  const firstName = authData?.user?.firstName ?? "Agent";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
    <OnboardingOverlay />
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 80 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={C.accent}
        />
      }
    >
      <View style={styles.greeting}>
        <View>
          <Text style={[styles.greetingText, { color: C.textSecondary }]}>
            {greeting},
          </Text>
          <Text style={[styles.name, { color: C.text }]}>{firstName}</Text>
        </View>
        <Pressable
          testID="today-notifications"
          style={[styles.iconBtn, { backgroundColor: C.surfaceAlt }]}
          onPress={() => {}}
        >
          {isIOS ? (
            <SymbolView name="bell" tintColor={C.text} size={20} />
          ) : (
            <Feather name="bell" size={20} color={C.text} />
          )}
        </Pressable>
      </View>

      {activeTour && (
        <Pressable
          testID="resume-tour-btn"
          onPress={() => router.push(`/tour/${activeTour.id}`)}
          style={({ pressed }) => [
            styles.resumeCard,
            { backgroundColor: C.accent },
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={styles.resumeContent}>
            <View>
              <Text style={styles.resumeLabel}>Active Tour</Text>
              <Text style={styles.resumeTitle} numberOfLines={1}>
                {activeTour.title}
              </Text>
            </View>
            {isIOS ? (
              <SymbolView name="arrow.right.circle.fill" tintColor="#FFF" size={26} />
            ) : (
              <Feather name="arrow-right-circle" size={26} color="#FFF" />
            )}
          </View>
          <Text style={styles.resumeStops}>
            {activeTour.stopCount ?? 0} stops · Tap to resume
          </Text>
        </Pressable>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>Today</Text>
        <Text style={[styles.sectionCount, { color: C.textSecondary }]}>
          {todayTours.length} tour{todayTours.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      )}

      {!isLoading && todayTours.length === 0 && (
        <View style={styles.empty}>
          {isIOS ? (
            <SymbolView name="calendar.badge.checkmark" tintColor={C.textTertiary} size={48} />
          ) : (
            <Feather name="calendar" size={48} color={C.textTertiary} />
          )}
          <Text style={[styles.emptyTitle, { color: C.text }]}>No tours today</Text>
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>
            Your scheduled tours will appear here
          </Text>
        </View>
      )}

      {nonCompletedTours.length > 0 && (
        <View style={[styles.group, { backgroundColor: C.surface }]}>
          {nonCompletedTours.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              buyerName={tour.buyerName ?? undefined}
              isActive={tour.status === "active"}
            />
          ))}
        </View>
      )}

      {completedToday.length > 0 && (
        <View style={styles.sectionGap}>
          <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>Completed</Text>
          <View style={[styles.group, { backgroundColor: C.surface }]}>
            {completedToday.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  greetingText: {
    fontSize: 15,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 2,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  resumeContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  resumeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  resumeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  resumeStops: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  sectionCount: {
    fontSize: 13,
  },
  sectionGap: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 12,
    overflow: "hidden",
  },
  loader: {
    paddingVertical: 40,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
