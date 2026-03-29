import { Feather } from "@expo/vector-icons";
import {
  useGetTour,
  useGenerateTourSummary,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusChip } from "@/components/StatusChip";
import Colors from "@/constants/colors";

export default function TourSummaryScreen() {
  const { tourId } = useLocalSearchParams<{ tourId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const { data, isLoading, refetch } = useGetTour(tourId ?? "", {
    query: { enabled: !!tourId },
  });

  const { mutate: generateSummary, isPending: isGenerating } = useGenerateTourSummary({
    mutation: { onSuccess: () => refetch() },
  });

  const tour = data?.tour;
  const stops = data?.stops ?? [];
  const buyer = data?.buyer;

  const visited = stops.filter((s) => s.visited && !s.skipped);
  const skipped = stops.filter((s) => s.skipped);

  const topRated = [...visited]
    .filter((s) => (s.overallFitRating ?? 0) >= 4)
    .sort((a, b) => (b.overallFitRating ?? 0) - (a.overallFitRating ?? 0));

  const topPad = isWeb ? 67 : 0;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.banner, { backgroundColor: C.primary }]}>
        {isIOS ? (
          <SymbolView name="flag.checkered.2.crossed" tintColor={C.accent} size={40} />
        ) : (
          <Feather name="flag" size={40} color={C.accent} />
        )}
        <Text style={styles.bannerTitle}>Tour Complete</Text>
        {buyer && (
          <Text style={styles.bannerBuyer}>{buyer.name}'s Tour</Text>
        )}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{visited.length}</Text>
            <Text style={styles.statLabel}>Visited</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{skipped.length}</Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{topRated.length}</Text>
            <Text style={styles.statLabel}>Top Rated</Text>
          </View>
        </View>
      </View>

      {topRated.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Top Rated Homes</Text>
          {topRated.map((s, i) => (
            <Pressable
              key={s.id}
              testID={`summary-stop-${i}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.stopRow,
                { backgroundColor: C.card, borderColor: C.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.stopRank, { backgroundColor: C.accent }]}>
                <Text style={styles.stopRankText}>{i + 1}</Text>
              </View>
              <View style={styles.stopContent}>
                <Text style={[styles.stopAddr, { color: C.text }]} numberOfLines={1}>
                  Stop #{s.sequence}
                </Text>
                <View style={styles.stopMeta}>
                  {"⭐".repeat(Math.round(s.overallFitRating ?? 0))}
                  <Text style={[styles.ratingText, { color: C.textSecondary }]}>
                    {" "}Overall fit: {s.overallFitRating}/5
                  </Text>
                </View>
              </View>
              {isIOS ? (
                <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
              ) : (
                <Feather name="chevron-right" size={14} color={C.textTertiary} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {skipped.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Skipped Stops</Text>
          {skipped.map((s, i) => (
            <View
              key={s.id}
              style={[styles.stopRow, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
            >
              <View style={styles.stopContent}>
                <Text style={[styles.stopAddr, { color: C.textSecondary }]} numberOfLines={1}>
                  Stop #{s.sequence}
                </Text>
                {s.skipReason && (
                  <Text style={[styles.skipReason, { color: C.textTertiary }]}>
                    {s.skipReason.replace(/_/g, " ")}
                  </Text>
                )}
              </View>
              <StatusChip status="cancelled" label="Skipped" small />
            </View>
          ))}
        </View>
      )}

      <Pressable
        testID="generate-summary-btn"
        onPress={() => generateSummary({ tourId: tourId ?? "" })}
        disabled={isGenerating}
        style={({ pressed }) => [
          styles.generateBtn,
          { backgroundColor: C.accent },
          (pressed || isGenerating) && { opacity: 0.7 },
        ]}
      >
        {isGenerating ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : isIOS ? (
          <SymbolView name="wand.and.stars" tintColor="#FFF" size={18} />
        ) : (
          <Feather name="zap" size={18} color="#FFF" />
        )}
        <Text style={styles.generateBtnLabel}>
          {isGenerating ? "Generating AI Summary…" : "Generate AI Summary"}
        </Text>
      </Pressable>

      <Pressable
        testID="done-btn"
        onPress={() => router.push("/(tabs)")}
        style={({ pressed }) => [
          styles.doneBtn,
          { backgroundColor: C.surfaceAlt },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.doneBtnLabel, { color: C.text }]}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20 },
  banner: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  bannerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  bannerBuyer: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 0,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
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
  stopRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stopRankText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  stopContent: { flex: 1 },
  stopAddr: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  stopMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  skipReason: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    textTransform: "capitalize",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  generateBtnLabel: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  doneBtnLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
