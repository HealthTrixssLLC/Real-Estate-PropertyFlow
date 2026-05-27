import { Feather } from "@expo/vector-icons";
import { useListTours } from "@workspace/api-client-react";
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

import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotesScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  const { data, isLoading, refetch, isRefetching } = useListTours();

  const tours = (data?.tours ?? []).filter(
    (t) => t.status === "completed" || t.status === "active"
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.accent} />
      }
      data={tours}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        tours.length > 0 ? (
          <Text style={[styles.sectionHeader, { color: C.textSecondary }]}>
            Tours with notes
          </Text>
        ) : null
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          testID={`notes-tour-${item.id}`}
          onPress={() => router.push(`/tour/${item.id}`)}
          style={({ pressed }) => [
            styles.row,
            pressed && { backgroundColor: Semantic.fillTertiary as unknown as string },
          ]}
        >
          <View style={[styles.tourIcon, { backgroundColor: C.accent + "20" }]}>
            {isIOS ? (
              <SymbolView
                name={item.status === "active" ? "house.fill" : "checkmark.circle.fill"}
                tintColor={C.accent}
                size={16}
              />
            ) : (
              <Feather
                name={item.status === "active" ? "home" : "check-circle"}
                size={16}
                color={C.accent}
              />
            )}
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: C.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.rowDate, { color: C.textSecondary }]}>
              {formatDate(item.date)}
            </Text>
          </View>
          {isIOS ? (
            <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
          ) : (
            <Feather name="chevron-right" size={14} color={C.textTertiary} />
          )}
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          {isIOS ? (
            <SymbolView name="note.text" tintColor={C.textTertiary} size={56} />
          ) : (
            <Feather name="file-text" size={56} color={C.textTertiary} />
          )}
          <Text style={[styles.emptyTitle, { color: C.text }]}>No notes yet</Text>
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>
            Voice recordings and text notes are captured per stop during your tours.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: Semantic.grouped as unknown as string,
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Semantic.background as unknown as string,
  },
  sectionHeader: {
    ...Typography.sectionHeader,
    marginBottom: 6,
  },
  rowsGroup: {
    backgroundColor: Semantic.groupedSurface as unknown as string,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: Semantic.groupedSurface as unknown as string,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Semantic.opaqueSeparator as unknown as string,
    marginLeft: 60,
  },
  tourIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.subheadline,
    fontWeight: "500",
  },
  rowDate: {
    ...Typography.footnote,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
