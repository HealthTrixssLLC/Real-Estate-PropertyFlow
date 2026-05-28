import { useListTours } from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TourCard } from "@/components/TourCard";
import {
  EmptyState,
  ScreenHeader,
  SearchField,
  SegmentedControl,
  SyncStatusPill,
} from "@/components/ui";
import { Brand, Radii, Spacing, sem } from "@/theme";

type Filter = "upcoming" | "active" | "completed" | "all";

const OPTIONS: { value: Filter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Done" },
  { value: "all", label: "All" },
];

export default function ToursScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useListTours();

  const all = data?.tours ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = all;
    if (filter === "upcoming") {
      list = all.filter((x) => x.status === "draft" || x.status === "published");
    } else if (filter !== "all") {
      list = all.filter((x) => x.status === filter);
    }
    if (q) {
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.buyerName ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [all, filter, search]);

  return (
    <View style={{ flex: 1, backgroundColor: sem("grouped") as string, paddingTop: insets.top }}>
      <ScreenHeader title="Tours" right={<SyncStatusPill />} />
      <View style={styles.controls}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search tours or buyers"
          testID="tours-search"
        />
        <SegmentedControl
          options={OPTIONS}
          value={filter}
          onChange={setFilter}
          testID="tours-filter"
        />
      </View>

      {isLoading && all.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.teal} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Brand.teal}
            />
          }
          ListEmptyComponent={
            <EmptyState
              sfSymbol="magnifyingglass"
              featherIcon="search"
              title={
                search
                  ? "No matches"
                  : filter === "upcoming"
                  ? "No upcoming tours"
                  : filter === "active"
                  ? "No active tours"
                  : filter === "completed"
                  ? "No completed tours yet"
                  : "No tours"
              }
              message={
                search
                  ? "Try a different search or clear the filters."
                  : "Create and publish tours from the dashboard to see them here."
              }
            />
          }
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
          renderItem={({ item, index }) => (
            <View
              style={{
                backgroundColor: sem("groupedSurface") as string,
                borderTopLeftRadius: index === 0 ? Radii.lg : 0,
                borderTopRightRadius: index === 0 ? Radii.lg : 0,
                borderBottomLeftRadius: index === filtered.length - 1 ? Radii.lg : 0,
                borderBottomRightRadius: index === filtered.length - 1 ? Radii.lg : 0,
              }}
            >
              <TourCard
                tour={item}
                buyerName={item.buyerName ?? undefined}
                isActive={item.status === "active"}
                isFirst={index === 0}
                isLast={index === filtered.length - 1}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg + 8 + Spacing.md,
    backgroundColor: sem("separator") as string,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
