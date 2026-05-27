import { Feather } from "@expo/vector-icons";
import { useListTours } from "@workspace/api-client-react";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
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

type FilterTab = "upcoming" | "active" | "completed" | "all";

const FILTER_TABS: { key: FilterTab; label: string; count?: (n: number) => string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export default function ToursScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const { data, isLoading, refetch, isRefetching } = useListTours();

  const all = data?.tours ?? [];

  const counts: Record<FilterTab, number> = {
    upcoming: all.filter((t) => t.status === "draft" || t.status === "published").length,
    active: all.filter((t) => t.status === "active").length,
    completed: all.filter((t) => t.status === "completed").length,
    all: all.length,
  };

  const filtered = all.filter((t) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return t.status === "draft" || t.status === "published";
    return t.status === filter;
  });

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: C.text }]}>Tours</Text>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: C.border }]}>
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          const count = counts[tab.key];
          return (
            <Pressable
              key={tab.key}
              testID={`filter-${tab.key}`}
              onPress={() => setFilter(tab.key)}
              style={({ pressed }) => [
                styles.filterChip,
                active
                  ? { backgroundColor: C.accent }
                  : { backgroundColor: C.surfaceAlt },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: active ? "#FFFFFF" : C.textSecondary },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.filterBadge,
                    { backgroundColor: active ? "rgba(255,255,255,0.25)" : C.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      { color: active ? "#FFF" : C.textSecondary },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {isIOS ? (
                <SymbolView name="house.lodge" tintColor={C.textTertiary} size={48} />
              ) : (
                <Feather name="home" size={48} color={C.textTertiary} />
              )}
              <Text style={[styles.emptyTitle, { color: C.text }]}>No tours found</Text>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                {filter === "upcoming"
                  ? "No upcoming tours scheduled"
                  : filter === "active"
                  ? "No tours are currently active"
                  : filter === "completed"
                  ? "No completed tours yet"
                  : "Create tours from the web app"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TourCard tour={item} buyerName={item.buyerName ?? undefined} isActive={item.status === "active"} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  filterBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 100,
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
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
    maxWidth: 240,
  },
});
