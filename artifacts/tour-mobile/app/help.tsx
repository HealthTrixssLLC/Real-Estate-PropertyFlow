import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

interface HelpItem {
  title: string;
  desc: string;
}

interface HelpSectionData {
  id: string;
  title: string;
  sfIcon: string;
  featherIcon: string;
  items: HelpItem[];
}

const HELP_SECTIONS: HelpSectionData[] = [
  {
    id: "active-tour",
    title: "Active Tour Workflow",
    sfIcon: "map.fill",
    featherIcon: "map",
    items: [
      { title: "Starting a tour", desc: "Tap a published tour on the Today tab to enter Active Tour mode. You'll see the current stop highlighted and the next stop below it." },
      { title: "Tour progress bar", desc: "The bar at the top shows how many stops you have visited vs. remaining. It updates as you complete each stop." },
      { title: "All Stops list", desc: "Scroll down to see every stop in sequence. Green dot = visited, blue = upcoming, gray = skipped." },
      { title: "Completing the tour", desc: 'After visiting all stops, tap "Tour Summary" in the action tray to generate your AI summary and wrap up.' },
    ],
  },
  {
    id: "navigate",
    title: "Navigate Button",
    sfIcon: "arrow.triangle.turn.up.right.circle.fill",
    featherIcon: "navigation",
    items: [
      { title: "Opening navigation", desc: "Tap Navigate in the action tray to open turn-by-turn directions to the current stop. On iPhone, TourFlow tries Google Maps first, then falls back to Apple Maps." },
      { title: "After navigating", desc: "When you arrive, switch back to TourFlow and tap Mark Arrived to confirm your arrival and unlock the Complete Showing button." },
      { title: "No address available", desc: "If a stop is missing an address, Navigate won't appear. Check the web app and add the property address in the Route Stops tab." },
    ],
  },
  {
    id: "mark-arrived",
    title: "Mark Arrived & Complete Showing",
    sfIcon: "mappin.circle.fill",
    featherIcon: "map-pin",
    items: [
      { title: "Mark Arrived", desc: "Tap Mark Arrived when you pull up to the property. This records your arrival time and switches the action tray to showing mode." },
      { title: "Complete Showing", desc: "Tap Complete Showing after you finish viewing the property with your client. This moves TourFlow to the next stop automatically." },
      { title: "What to do during the showing", desc: "While at the property, use the stop detail screen to record voice notes, assign star ratings, set quick tags, and flag follow-ups." },
    ],
  },
  {
    id: "skip-stop",
    title: "Skipping a Stop",
    sfIcon: "forward.fill",
    featherIcon: "skip-forward",
    items: [
      { title: "When to skip", desc: "Tap Skip if a showing was cancelled last-minute, the client wants to pass on the property, or you need to reorder your tour on the fly." },
      { title: "Skip reason", desc: "TourFlow will ask you to select a reason (e.g. Cancelled, Not Interested, Ran Out of Time). This is captured in the tour record." },
      { title: "Skipped stops on the map", desc: "Skipped stops appear grayed-out in the All Stops list. You can visit a skipped stop by tapping it and navigating there manually." },
    ],
  },
  {
    id: "voice-notes",
    title: "Recording Voice Notes",
    sfIcon: "mic.fill",
    featherIcon: "mic",
    items: [
      { title: "Opening the recorder", desc: "On any stop detail screen, scroll to the Notes section and tap Record Note. The microphone must be allowed — you will be prompted on first use." },
      { title: "Recording", desc: "Hold or tap to start. Speak your observations clearly. Tap Stop when done. The audio uploads immediately if you have a signal." },
      { title: "Offline mode", desc: "No signal? Your recording is saved locally on the device and uploads automatically when connectivity returns." },
      { title: "Transcription", desc: "Within seconds of uploading, TourFlow transcribes your audio using AI. The text appears below the recording timestamp. All transcripts feed into the final AI summary." },
    ],
  },
  {
    id: "star-ratings",
    title: "Star Ratings",
    sfIcon: "star.fill",
    featherIcon: "star",
    items: [
      { title: "Rating categories", desc: "You can rate each property on: Overall Fit, Buyer Interest, Kitchen, Primary Suite, Backyard, and Road Noise. Tap the stars to set a score from 1–5." },
      { title: "Why rate each category", desc: "Granular ratings give the AI summary richer data, leading to more specific recommendations and a more useful buyer recap." },
      { title: "Quick Tags", desc: "Below ratings, tap Quick Tags like 'Great layout' or 'Dated kitchen' for fast, one-tap observations that also appear in the AI summary." },
    ],
  },
  {
    id: "ai-summary",
    title: "Generating an AI Summary",
    sfIcon: "sparkles",
    featherIcon: "zap",
    items: [
      { title: "When to generate", desc: "After visiting all stops (or when you are ready to wrap up), tap Tour Summary in the action tray, then tap Generate AI Summary." },
      { title: "What goes in", desc: "The AI reads all your ratings, voice note transcripts, quick tags, and follow-up flags from every stop to build the summary." },
      { title: "The output", desc: "You get a structured recap with top picks, per-property highlights, and recommended next steps based on buyer interest scores." },
      { title: "Sharing", desc: "Copy the summary text to paste into an email, text message, or CRM note to send to your buyer." },
    ],
  },
];

export default function HelpScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const [expanded, setExpanded] = useState<string | null>(null);

  const topPad = isWeb ? 67 : insets.top;

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 8, paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={12}
      >
        {isIOS ? (
          <SymbolView name="chevron.left" tintColor={C.accent} size={16} />
        ) : (
          <Feather name="chevron-left" size={16} color={C.accent} />
        )}
        <Text style={[styles.backText, { color: C.accent }]}>Settings</Text>
      </Pressable>

      <Text style={[styles.title, { color: C.text }]}>Help & Guide</Text>
      <Text style={[styles.subtitle, { color: C.textSecondary }]}>
        Tap a section to expand step-by-step instructions.
      </Text>

      <View style={styles.introCard}>
        <Text style={[styles.introText, { color: C.textSecondary }]}>
          TourFlow workflow in 3 steps:{"\n"}
          <Text style={{ color: C.text, fontWeight: "600" }}>1.</Text> Plan your tour on the web app{"\n"}
          <Text style={{ color: C.text, fontWeight: "600" }}>2.</Text> Execute stops on your phone{"\n"}
          <Text style={{ color: C.text, fontWeight: "600" }}>3.</Text> Review the AI summary with your client
        </Text>
      </View>

      {HELP_SECTIONS.map((section) => {
        const isOpen = expanded === section.id;
        return (
          <View
            key={section.id}
            style={[styles.section, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Pressable
              onPress={() => setExpanded(isOpen ? null : section.id)}
              style={styles.sectionHeader}
              testID={`help-section-${section.id}`}
            >
              <View style={styles.sectionLeft}>
                <View style={[styles.iconWrap, { backgroundColor: C.accent + "18" }]}>
                  {isIOS ? (
                    <SymbolView name={section.sfIcon as any} tintColor={C.accent} size={18} />
                  ) : (
                    <Feather name={section.featherIcon as any} size={18} color={C.accent} />
                  )}
                </View>
                <Text style={[styles.sectionTitle, { color: C.text }]}>{section.title}</Text>
              </View>
              {isIOS ? (
                <SymbolView
                  name={isOpen ? "chevron.up" : "chevron.down"}
                  tintColor={C.textTertiary}
                  size={14}
                />
              ) : (
                <Feather
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={C.textTertiary}
                />
              )}
            </Pressable>

            {isOpen && (
              <View style={[styles.sectionBody, { borderTopColor: C.border }]}>
                {section.items.map((item, i) => (
                  <View
                    key={i}
                    style={[
                      styles.item,
                      i < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                    ]}
                  >
                    <View style={[styles.bullet, { backgroundColor: C.accent }]} />
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTitle, { color: C.text }]}>{item.title}</Text>
                      <Text style={[styles.itemDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  introCard: {
    backgroundColor: "rgba(99,102,241,0.08)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  introText: {
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
