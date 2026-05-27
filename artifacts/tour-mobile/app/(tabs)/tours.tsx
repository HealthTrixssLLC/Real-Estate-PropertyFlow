import { Feather } from "@expo/vector-icons";
import { useListTours } from "@workspace/api-client-react";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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
import { useNavigation } from "expo-router";

import { TourCard } from "@/components/TourCard";
import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";

type FilterTab = "upcoming" | "active" | "completed" | "all";

const FILTER_LABELS: Record<FilterTab, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  all: "All Tours",
};

const FILTER_ORDER: FilterTab[] = ["upcoming", "active", "completed", "all"];

export default function ToursScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const navigation = useNavigation();

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

  const showFilterSheet = useCallback(() => {
    const options = FILTER_ORDER.map((k) => {
      const n = counts[k];
      return `${FILTER_LABELS[k]}${n > 0 ? ` (${n})` : ""}`;
    });

    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...options],
          cancelButtonIndex: 0,
          title: "Filter Tours",
        },
        (idx) => {
          if (idx >= 1 && idx <= FILTER_ORDER.length) {
            setFilter(FILTER_ORDER[idx - 1]);
          }
        }
      );
    } else {
      Alert.alert(
        "Filter Tours",
        undefined,
        [
          ...FILTER_ORDER.map((k) => ({
            text: `${FILTER_LABELS[k]}${counts[k] > 0 ? ` (${counts[k]})` : ""}`,
            onPress: () => setFilter(k),
          })),
          { text: "Cancel", style: "cancel" as const },
        ]
      );
    }
  }, [counts, isIOS]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={showFilterSheet}
          hitSlop={8}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginRight: 4 }]}
          testID="tours-filter-btn"
        >
          {isIOS ? (
            <SymbolView
              name="line.3.horizontal.decrease.circle"
              tintColor={C.accent}
              size={24}
            />
          ) : (
            <Feather name="filter" size={22} color={C.accent} />
          )}
        </Pressable>
      ),
    });
  }, [navigation, showFilterSheet, C.accent, isIOS]);

  const isFiltered = filter !== "upcoming";

  return (
    <View style={styles.container}>
      {isFiltered && (
        <View style={[styles.filterBanner, { backgroundColor: C.accent + "15", borderBottomColor: C.accent + "40" }]}>
          <Text style={[styles.filterBannerText, { color: C.accent }]}>
            Showing: {FILTER_LABELS[filter]}
          </Text>
          <Pressable onPress={() => setFilter("upcoming")} hitSlop={6}>
            {isIOS ? (
              <SymbolView name="xmark.circle.fill" tintColor={C.accent} size={16} />
            ) : (
              <Feather name="x-circle" size={16} color={C.accent} />
            )}
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 80 },
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
                <SymbolView name="house.lodge" tintColor={Semantic.labelTertiary as string} size={48} />
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
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterBannerText: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingTop: 0,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    ...Typography.headline,
  },
  emptyText: {
    ...Typography.subheadline,
    textAlign: "center",
    maxWidth: 240,
  },
});
