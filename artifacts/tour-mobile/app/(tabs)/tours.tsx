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

const FILTER_TABS: { key: FilterTab; label: string }[] = [
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

      <View style={[styles.filterRow, { borderBottomColor: C.border }]}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            testID={`filter-${tab.key}`}
            onPress={() => setFilter(tab.key)}
            style={[
              styles.filterTab,
              filter === tab.key && { borderBottomColor: C.accent, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                { color: filter === tab.key ? C.accent : C.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
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
          scrollEnabled={filtered.length > 0}
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
                Create tours from the web app
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
  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
  },
});
