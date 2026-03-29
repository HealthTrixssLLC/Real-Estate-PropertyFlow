import { Feather } from "@expo/vector-icons";
import { useListTours, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TourCard } from "@/components/TourCard";
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

  const topPad = isWeb ? 67 : insets.top;

  return (
    <FlatList
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: isWeb ? 34 : insets.bottom + 16 },
      ]}
      data={nonCompletedTours}
      keyExtractor={(item) => item.id}
      scrollEnabled={nonCompletedTours.length > 0}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={C.accent}
        />
      }
      ListHeaderComponent={
        <View>
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
                  <SymbolView name="arrow.right.circle.fill" tintColor="#FFF" size={32} />
                ) : (
                  <Feather name="arrow-right-circle" size={32} color="#FFF" />
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

          {!isLoading && nonCompletedTours.length === 0 && completedToday.length === 0 && (
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
        </View>
      }
      renderItem={({ item }) => <TourCard tour={item} buyerName={item.buyerName ?? undefined} isActive={item.status === "active"} />}
      ListFooterComponent={
        completedToday.length > 0 ? (
          <View style={styles.completedSection}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary, marginBottom: 8 }]}>
              Completed
            </Text>
            {completedToday.map((t) => (
              <TourCard key={t.id} tour={t} />
            ))}
          </View>
        ) : null
      }
    />
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
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  name: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
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
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  resumeContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  resumeLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  resumeTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  resumeStops: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  completedSection: {
    marginTop: 8,
  },
});
