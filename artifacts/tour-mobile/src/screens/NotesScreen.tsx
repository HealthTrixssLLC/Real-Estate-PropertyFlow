import { useListTours } from "@workspace/api-client-react";
import { router } from "@/lib/navigation";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EmptyState,
  ListGroup,
  ListRow,
  ScreenHeader,
  SearchField,
  SyncStatusPill,
} from "@/components/ui";
import { Brand, Spacing, sem } from "@/theme";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useListTours();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const all = (data?.tours ?? []).filter(
      (t) => t.status === "completed" || t.status === "active"
    );
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.buyerName ?? "").toLowerCase().includes(q)
        )
      : all;
    const active = filtered.filter((t) => t.status === "active");
    const completed = filtered
      .filter((t) => t.status === "completed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { active, completed };
  }, [data, search]);

  if (isLoading && !data) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: sem("grouped") as string, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator color={Brand.teal} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: sem("grouped") as string }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
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
    >
      <ScreenHeader
        title="Notes"
        subtitle="Voice memos & impressions per stop"
        right={<SyncStatusPill />}
      />

      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search tours or buyers"
          testID="notes-search"
        />
      </View>

      {groups.active.length === 0 && groups.completed.length === 0 && (
        <EmptyState
          sfSymbol="note.text"
          featherIcon="file-text"
          title={search ? "No matches" : "No tour notes yet"}
          message={
            search
              ? "Try a different search term."
              : "Voice memos and typed notes you capture during a tour show up here grouped by tour."
          }
        />
      )}

      {groups.active.length > 0 && (
        <ListGroup header="In progress">
          {groups.active.map((tour, i, arr) => (
            <ListRow
              key={tour.id}
              testID={`notes-tour-${tour.id}`}
              title={tour.title}
              subtitle={`${tour.buyerName ?? "Unassigned"} · ${formatDate(tour.date)}`}
              sfSymbol="dot.radiowaves.up.forward"
              featherIcon="activity"
              iconBg={Brand.teal + "1F"}
              iconColor={Brand.teal}
              isFirst={i === 0}
              isLast={i === arr.length - 1}
              onPress={() => router.push(`/tour/${tour.id}`)}
            />
          ))}
        </ListGroup>
      )}

      {groups.completed.length > 0 && (
        <ListGroup header="Completed">
          {groups.completed.map((tour, i, arr) => (
            <ListRow
              key={tour.id}
              testID={`notes-tour-${tour.id}`}
              title={tour.title}
              subtitle={`${tour.buyerName ?? "Unassigned"} · ${formatDate(tour.date)}`}
              sfSymbol="checkmark.circle.fill"
              featherIcon="check-circle"
              iconBg="#34C75922"
              iconColor="#34C759"
              isFirst={i === 0}
              isLast={i === arr.length - 1}
              onPress={() => router.push(`/tour/${tour.id}/summary`)}
            />
          ))}
        </ListGroup>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
