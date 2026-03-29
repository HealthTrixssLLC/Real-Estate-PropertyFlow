import { Feather } from "@expo/vector-icons";
import { useListTours } from "@workspace/api-client-react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

interface NoteItem {
  id: string;
  tourId: string;
  tourTitle: string;
  stopId: string;
  address: string;
  note: string;
  createdAt: string;
}

export default function NotesScreen() {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const { data: toursData } = useListTours();
  const recentTour = toursData?.tours?.find(
    (t) => t.status === "active" || t.status === "completed"
  );

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: C.text }]}>Notes</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>
          Visit stop details to view and add notes
        </Text>
      </View>

      <View style={styles.empty}>
        {isIOS ? (
          <SymbolView name="note.text" tintColor={C.textTertiary} size={56} />
        ) : (
          <Feather name="file-text" size={56} color={C.textTertiary} />
        )}
        <Text style={[styles.emptyTitle, { color: C.text }]}>Stop Notes</Text>
        <Text style={[styles.emptyText, { color: C.textSecondary }]}>
          Notes and voice recordings are captured per stop during your tour.
        </Text>
        {recentTour && (
          <Pressable
            testID="view-recent-tour"
            onPress={() => router.push(`/tour/${recentTour.id}`)}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: C.accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaLabel}>Open Recent Tour</Text>
          </Pressable>
        )}
      </View>
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
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
    marginTop: -60,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  cta: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaLabel: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
