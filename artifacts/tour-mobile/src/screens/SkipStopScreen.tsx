import { Feather } from "@/lib/icon";
import type { ComponentProps } from "react";
import { useSkipTourStop, getGetTourQueryKey } from "@workspace/api-client-react";
import type { SkipStopRequestReason } from "@workspace/api-client-react";
import * as Haptics from "@/lib/haptics";
import { router, useLocalSearchParams } from "@/lib/navigation";
import { SymbolView, type SFSymbol } from "@/lib/icon";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const REASONS: { key: SkipStopRequestReason; label: string; sfIcon: SFSymbol; featherIcon: ComponentProps<typeof Feather>["name"] }[] = [
  { key: "not_approved", label: "Not approved", sfIcon: "xmark.circle", featherIcon: "x-circle" },
  { key: "client_changed_mind", label: "Client changed mind", sfIcon: "person.fill.questionmark", featherIcon: "user-x" },
  { key: "running_late", label: "Running late", sfIcon: "clock.badge.exclamationmark", featherIcon: "clock" },
  { key: "access_issue", label: "Access issue", sfIcon: "lock.slash", featherIcon: "lock" },
  { key: "traffic", label: "Traffic", sfIcon: "car.2", featherIcon: "truck" },
  { key: "duplicate_choice", label: "Duplicate / already seen", sfIcon: "doc.on.doc", featherIcon: "copy" },
  { key: "other", label: "Other", sfIcon: "ellipsis.circle", featherIcon: "more-horizontal" },
];

export default function SkipStopSheet() {
  const { stopId, tourId } = useLocalSearchParams<{ stopId: string; tourId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const [selected, setSelected] = useState<SkipStopRequestReason | null>(null);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { mutate: skipStop, isPending } = useSkipTourStop({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (tourId) {
          void queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(tourId) });
        }
        router.back();
      },
    },
  });

  const handleSkip = () => {
    if (!selected || !stopId || !tourId) return;
    skipStop({
      tourId,
      data: { stopId, reason: selected, notes: notes.trim() || undefined },
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: C.text }]}>Skip Stop</Text>
        <Text style={[styles.subtitle, { color: C.textSecondary }]}>
          Why are you skipping this stop?
        </Text>
      </View>

      <View style={styles.reasons}>
        {REASONS.map((r) => {
          const isSelected = selected === r.key;
          return (
            <Pressable
              key={r.key}
              testID={`skip-reason-${r.key}`}
              onPress={() => {
                setSelected(r.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.reasonBtn,
                {
                  backgroundColor: isSelected ? C.accent : C.card,
                  borderColor: isSelected ? C.accent : C.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isIOS ? (
                <SymbolView name={r.sfIcon} tintColor={isSelected ? "#FFF" : C.textSecondary} size={18} />
              ) : (
                <Feather name={r.featherIcon} size={18} color={isSelected ? "#FFF" : C.textSecondary} />
              )}
              <Text
                style={[
                  styles.reasonLabel,
                  { color: isSelected ? "#FFF" : C.text },
                ]}
              >
                {r.label}
              </Text>
              {isSelected && (
                isIOS ? (
                  <SymbolView name="checkmark.circle.fill" tintColor="#FFF" size={18} />
                ) : (
                  <Feather name="check-circle" size={18} color="#FFF" />
                )
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.notesSection}>
        <Text style={[styles.notesLabel, { color: C.text }]}>Notes (optional)</Text>
        <TextInput
          testID="skip-notes-input"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any additional context…"
          placeholderTextColor={C.textTertiary}
          multiline
          style={[
            styles.notesInput,
            { backgroundColor: C.card, borderColor: C.border, color: C.text },
          ]}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="skip-cancel-btn"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.cancelBtn,
            { backgroundColor: C.surfaceAlt },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.cancelLabel, { color: C.text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          testID="skip-confirm-btn"
          onPress={handleSkip}
          disabled={!selected || isPending}
          style={({ pressed }) => [
            styles.confirmBtn,
            { backgroundColor: C.coral },
            (!selected || isPending) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {isPending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.confirmLabel}>Skip Stop</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  reasons: {
    gap: 8,
    marginBottom: 20,
  },
  reasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  notesSection: {
    marginBottom: 24,
    gap: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
