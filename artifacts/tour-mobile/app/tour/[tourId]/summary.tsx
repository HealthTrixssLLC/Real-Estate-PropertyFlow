import { Feather } from "@expo/vector-icons";
import {
  useGetTour,
  useGenerateTourSummary,
  getGetTourQueryKey,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Linking from "expo-linking";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusChip } from "@/components/StatusChip";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function TourSummaryScreen() {
  const { tourId } = useLocalSearchParams<{ tourId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const { data, isLoading, refetch } = useGetTour(tourId ?? "", {
    query: { queryKey: getGetTourQueryKey(tourId ?? ""), enabled: !!tourId },
  });

  const { mutate: generateSummary, isPending: isGenerating } = useGenerateTourSummary({
    mutation: { onSuccess: () => refetch() },
  });

  const { token } = useAuth();
  const [shareBusy, setShareBusy] = React.useState<null | "share" | "email" | "sms">(null);

  async function fetchShareUrl(): Promise<{ url: string; filename: string } | null> {
    if (!tourId) return null;
    const apiBase =
      process.env.EXPO_PUBLIC_API_URL ??
      `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    const res = await fetch(`${apiBase}/api/tours/${tourId}/report/share-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || `Could not build share link (${res.status})`);
    }
    return res.json();
  }

  async function handleShareReport() {
    setShareBusy("share");
    try {
      const out = await fetchShareUrl();
      if (!out) return;
      await Share.share({
        message: `Your tour report: ${out.url}`,
        url: out.url,
        title: out.filename,
      });
    } catch (err) {
      Alert.alert("Share failed", err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(null);
    }
  }

  async function handleEmailReport() {
    if (!buyer?.email) {
      Alert.alert("No email", "Add an email to the buyer first.");
      return;
    }
    setShareBusy("email");
    try {
      const out = await fetchShareUrl();
      if (!out) return;
      const subject = encodeURIComponent(`Your tour report${tour?.title ? ` — ${tour.title}` : ""}`);
      const body = encodeURIComponent(
        `Hi${buyer?.name ? ` ${buyer.name.split(" ")[0]}` : ""},\n\nHere is the report from your tour:\n${out.url}\n\n(Link expires in 7 days.)`,
      );
      const ok = await Linking.canOpenURL("mailto:");
      if (!ok) throw new Error("No email app available on this device.");
      await Linking.openURL(`mailto:${buyer.email}?subject=${subject}&body=${body}`);
    } catch (err) {
      Alert.alert("Email failed", err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(null);
    }
  }

  async function handleSmsReport() {
    if (!buyer?.phone) {
      Alert.alert("No phone", "Add a phone number to the buyer first.");
      return;
    }
    setShareBusy("sms");
    try {
      const out = await fetchShareUrl();
      if (!out) return;
      const sep = Platform.OS === "ios" ? "&" : "?";
      const body = encodeURIComponent(
        `${buyer?.name ? `Hi ${buyer.name.split(" ")[0]}, ` : ""}your tour report is ready: ${out.url} (link expires in 7 days)`,
      );
      const url = `sms:${buyer.phone}${sep}body=${body}`;
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error("Texting not available on this device.");
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert("SMS failed", err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(null);
    }
  }

  const tour = data?.tour;
  const stops = data?.stops ?? [];
  const buyer = data?.buyer;
  const pendingTranscriptions = data?.pendingTranscriptions ?? 0;

  const visited = stops.filter((s) => s.visited && !s.skipped);
  const skipped = stops.filter((s) => s.skipped);

  const topRated = [...visited]
    .filter((s) => (s.overallFitRating ?? 0) >= 4)
    .sort((a, b) => (b.overallFitRating ?? 0) - (a.overallFitRating ?? 0));

  const followUps = visited.filter((s) => s.followUpFlag);
  const revisits = visited.filter((s) => s.revisitFlag);

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
        {(followUps.length > 0 || revisits.length > 0) && (
          <View style={styles.notesStat}>
            {followUps.length > 0 && (
              <Text style={styles.notesStatText}>
                {followUps.length} follow-up{followUps.length !== 1 ? "s" : ""}
              </Text>
            )}
            {revisits.length > 0 && (
              <Text style={styles.notesStatText}>
                {revisits.length} second look{revisits.length !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
        )}
        {pendingTranscriptions > 0 && (
          <View style={[styles.transcriptionBadge]}>
            {isIOS ? (
              <SymbolView name="waveform.badge.magnifyingglass" tintColor="rgba(255,255,255,0.9)" size={14} />
            ) : (
              <Feather name="loader" size={14} color="rgba(255,255,255,0.9)" />
            )}
            <Text style={styles.transcriptionText}>
              {pendingTranscriptions} voice note{pendingTranscriptions !== 1 ? "s" : ""} pending transcription
            </Text>
          </View>
        )}
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

      {(followUps.length > 0 || revisits.length > 0) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Action Items</Text>
          {followUps.map((s) => (
            <Pressable
              key={`fu-${s.id}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.actionRow,
                { backgroundColor: C.card, borderColor: C.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isIOS ? (
                <SymbolView name="bookmark.fill" tintColor={C.amber} size={16} />
              ) : (
                <Feather name="bookmark" size={16} color={C.amber} />
              )}
              <View style={styles.actionRowContent}>
                <Text style={[styles.actionRowLabel, { color: C.text }]}>
                  Stop #{s.sequence} — Follow Up
                </Text>
                {s.quickTags && s.quickTags.length > 0 && (
                  <Text style={[styles.actionRowSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {s.quickTags.join(", ")}
                  </Text>
                )}
              </View>
              {isIOS ? (
                <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
              ) : (
                <Feather name="chevron-right" size={14} color={C.textTertiary} />
              )}
            </Pressable>
          ))}
          {revisits.map((s) => (
            <Pressable
              key={`rv-${s.id}`}
              onPress={() => router.push(`/stop/${s.id}`)}
              style={({ pressed }) => [
                styles.actionRow,
                { backgroundColor: C.card, borderColor: C.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isIOS ? (
                <SymbolView name="arrow.uturn.right.circle.fill" tintColor={C.accent} size={16} />
              ) : (
                <Feather name="refresh-cw" size={16} color={C.accent} />
              )}
              <View style={styles.actionRowContent}>
                <Text style={[styles.actionRowLabel, { color: C.text }]}>
                  Stop #{s.sequence} — Second Look
                </Text>
                {s.quickTags && s.quickTags.length > 0 && (
                  <Text style={[styles.actionRowSub, { color: C.textSecondary }]} numberOfLines={1}>
                    {s.quickTags.join(", ")}
                  </Text>
                )}
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>Tour Report</Text>
        <View style={styles.reportActions}>
          <Pressable
            testID="report-share-btn"
            onPress={handleShareReport}
            disabled={shareBusy !== null}
            style={({ pressed }) => [
              styles.reportActionBtn,
              { backgroundColor: C.accent },
              (pressed || shareBusy === "share") && { opacity: 0.7 },
            ]}
          >
            {shareBusy === "share" ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : isIOS ? (
              <SymbolView name="square.and.arrow.up" tintColor="#FFF" size={18} />
            ) : (
              <Feather name="share-2" size={18} color="#FFF" />
            )}
            <Text style={styles.reportActionLabel}>Share PDF</Text>
          </Pressable>
          <Pressable
            testID="report-email-btn"
            onPress={handleEmailReport}
            disabled={shareBusy !== null || !buyer?.email}
            style={({ pressed }) => [
              styles.reportActionBtn,
              { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
              (pressed || shareBusy === "email" || !buyer?.email) && { opacity: 0.7 },
            ]}
          >
            {shareBusy === "email" ? (
              <ActivityIndicator color={C.text} size="small" />
            ) : isIOS ? (
              <SymbolView name="envelope" tintColor={C.text} size={18} />
            ) : (
              <Feather name="mail" size={18} color={C.text} />
            )}
            <Text style={[styles.reportActionLabel, { color: C.text }]}>Email</Text>
          </Pressable>
          <Pressable
            testID="report-sms-btn"
            onPress={handleSmsReport}
            disabled={shareBusy !== null || !buyer?.phone}
            style={({ pressed }) => [
              styles.reportActionBtn,
              { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
              (pressed || shareBusy === "sms" || !buyer?.phone) && { opacity: 0.7 },
            ]}
          >
            {shareBusy === "sms" ? (
              <ActivityIndicator color={C.text} size="small" />
            ) : isIOS ? (
              <SymbolView name="message" tintColor={C.text} size={18} />
            ) : (
              <Feather name="message-circle" size={18} color={C.text} />
            )}
            <Text style={[styles.reportActionLabel, { color: C.text }]}>Text</Text>
          </Pressable>
        </View>
        {(!buyer?.email || !buyer?.phone) && (
          <Text style={[styles.reportHint, { color: C.textTertiary }]}>
            {!buyer?.email && !buyer?.phone
              ? "Add email and phone to the buyer to enable Email and Text."
              : !buyer?.email
                ? "Add an email to the buyer to enable Email."
                : "Add a phone number to the buyer to enable Text."}
          </Text>
        )}
      </View>

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
    fontWeight: "bold",
    color: "#FFF",
  },
  bannerBuyer: {
    fontSize: 15,
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
    fontWeight: "bold",
    color: "#FFF",
  },
  statLabel: {
    fontSize: 12,
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
    fontWeight: "bold",
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
    fontWeight: "bold",
  },
  stopContent: { flex: 1 },
  stopAddr: {
    fontSize: 14,
    fontWeight: "600",
  },
  stopMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
  },
  skipReason: {
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  notesStat: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  notesStatText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionRowContent: { flex: 1 },
  actionRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionRowSub: {
    fontSize: 12,
    marginTop: 2,
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
    fontWeight: "600",
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  doneBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  transcriptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "center",
  },
  transcriptionText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  reportActions: {
    flexDirection: "row",
    gap: 8,
  },
  reportActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reportActionLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  reportHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
