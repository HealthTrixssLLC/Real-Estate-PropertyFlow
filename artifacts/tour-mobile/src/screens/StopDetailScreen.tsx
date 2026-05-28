import { Feather } from "@/lib/icon";
import {
  useGetTourStop,
  useAddStopNote,
  useUpdateTourStop,
  useDeleteTourStop,
  useGetTour,
  useGetDebrief,
  useMarkStopCompleted,
  useMarkStopUnvisited,
  getGetTourStopQueryKey,
  getGetTourQueryKey,
  getGetDebriefQueryKey,
} from "@workspace/api-client-react";
import type { UpdateTourStopRequest, TourStopDetailResponse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "@/lib/haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "@/lib/navigation";
import { SymbolView, type SFSymbol } from "@/lib/icon";
import React, { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { StarRating } from "@/components/StarRating";
import { StatusChip } from "@/components/StatusChip";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { DebriefSheet } from "@/components/DebriefSheet";
import Colors from "@/constants/colors";
import { Semantic } from "@/constants/semantic";
import { Typography } from "@/constants/typography";

type RatingField = "overallFitRating" | "buyerInterest" | "kitchenRating" | "primarySuiteRating" | "backyardRating" | "roadNoiseRating";

const QUICK_TAG_OPTIONS = [
  "Great location",
  "Needs work",
  "Too small",
  "Great layout",
  "Good light",
  "Noisy street",
  "Nice yard",
  "Dated kitchen",
  "Updated bath",
  "Strong buy",
];

function FitScoreMeter({ score }: { score: number }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const color = score >= 75 ? C.green : score >= 50 ? C.amber : C.coral;
  return (
    <View style={meterStyles.wrap}>
      <View style={[meterStyles.ring, { borderColor: color + "44" }]}>
        <Text style={[meterStyles.score, { color }]}>{score}</Text>
        <Text style={[meterStyles.sub, { color: C.textTertiary }]}>/100</Text>
      </View>
      <View style={meterStyles.labels}>
        <Text style={[meterStyles.scoreLabel, { color }]}>
          {score >= 75 ? "Strong Fit" : score >= 50 ? "Moderate Fit" : "Weak Fit"}
        </Text>
      </View>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  score: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 24 },
  sub: { fontSize: 9, fontFamily: "Inter_500Medium" },
  labels: { flex: 1 },
  scoreLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
});

function InfoRow({
  label,
  value,
  sfIcon,
  featherIcon,
  C,
  isIOS,
  onPress,
}: {
  label: string;
  value: string;
  sfIcon: SFSymbol;
  featherIcon: ComponentProps<typeof Feather>["name"];
  C: (typeof Colors)["light"];
  isIOS: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoRow,
        pressed && onPress ? { opacity: 0.7 } : null,
      ]}
    >
      {isIOS ? (
        <SymbolView name={sfIcon} tintColor={C.textSecondary} size={15} />
      ) : (
        <Feather name={featherIcon} size={15} color={C.textSecondary} />
      )}
      <Text style={[styles.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.infoValue, { color: onPress ? C.accent : C.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function FlagRow({
  label,
  C,
  isIOS,
}: {
  label: string;
  C: (typeof Colors)["light"];
  isIOS: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      {isIOS ? (
        <SymbolView name="exclamationmark.circle" tintColor={C.amber} size={15} />
      ) : (
        <Feather name="alert-circle" size={15} color={C.amber} />
      )}
      <Text style={[styles.infoValue, { color: C.text, flex: 1, marginLeft: 0 }]}>
        {label}
      </Text>
    </View>
  );
}

export default function StopDetailScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const navigation = useNavigation();

  const [noteText, setNoteText] = useState("");
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [restrictionsExpanded, setRestrictionsExpanded] = useState(false);
  const [showDebriefSheet, setShowDebriefSheet] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const voiceY = useRef(0);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useGetTourStop(stopId ?? "", {
    query: {
      queryKey: getGetTourStopQueryKey(stopId ?? ""),
      enabled: !!stopId,
      refetchInterval: (query) => {
        const voiceNotes = (query.state.data as TourStopDetailResponse | undefined)?.voiceNotes ?? [];
        const hasPending = voiceNotes.some(
          (vn) => vn.transcriptionStatus === "pending" || vn.transcriptionStatus === "in_progress"
        );
        return hasPending ? 3000 : false;
      },
    },
  });

  const stop = data?.stop;
  const property = data?.property;
  const showingRequest = data?.showingRequest;
  const restrictionNote = data?.restrictionNote;
  const voiceNotes = data?.voiceNotes ?? [];
  const summary = data?.propertySummary;
  const debrief = data?.debrief;

  // Poll debrief status if processing
  const isDebriefProcessing =
    debrief?.processingStatus === "pending" ||
    debrief?.processingStatus === "transcribing" ||
    debrief?.processingStatus === "scoring";

  const { data: polledDebrief } = useGetDebrief(stopId ?? "", {
    query: {
      queryKey: getGetDebriefQueryKey(stopId ?? ""),
      enabled: !!stopId && isDebriefProcessing,
      refetchInterval: 4000,
    },
  });

  const activeDebrief = isDebriefProcessing && polledDebrief?.debrief
    ? polledDebrief.debrief
    : debrief ?? null;

  const { mutate: addNote, isPending: isAddingNote } = useAddStopNote({
    mutation: { onSuccess: () => { setNoteText(""); refetch(); } },
  });

  const { mutate: updateStop } = useUpdateTourStop({
    mutation: { onSuccess: () => refetch() },
  });

  const { mutate: deleteStop, isPending: isDeletingStop } = useDeleteTourStop();

  const { mutateAsync: markVisitedAsync, isPending: isMarkingVisited } = useMarkStopCompleted();
  const { mutateAsync: markUnvisitedAsync, isPending: isMarkingUnvisited } = useMarkStopUnvisited();
  const isTogglingVisited = isMarkingVisited || isMarkingUnvisited;

  const handleToggleVisited = async () => {
    if (!stopId || !stop) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (stop.visited) {
        await markUnvisitedAsync({ stopId });
      } else {
        await markVisitedAsync({ stopId });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await queryClient.invalidateQueries({ queryKey: getGetTourStopQueryKey(stopId) });
      if (stop.tourId) {
        await queryClient.invalidateQueries({ queryKey: getGetTourQueryKey(stop.tourId) });
      }
      refetch();
    } catch {
      Alert.alert("Update failed", "Could not change visited status. Please try again.");
    }
  };

  const { data: tourData } = useGetTour(stop?.tourId ?? "", {
    query: {
      queryKey: getGetTourQueryKey(stop?.tourId ?? ""),
      enabled: !!stop?.tourId,
    },
  });
  const tourStatus = tourData?.tour?.status;

  const handleRemoveStop = () => {
    if (!stopId || !stop) return;
    Alert.alert(
      "Remove Stop",
      "Are you sure you want to remove this stop from the tour?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            deleteStop(
              { stopId },
              {
                onSuccess: () => {
                  void queryClient.invalidateQueries({
                    queryKey: getGetTourQueryKey(stop.tourId),
                  });
                  router.replace(`/tour/${stop.tourId}`);
                },
                onError: () => {
                  Alert.alert("Error", "Failed to remove stop. Please try again.");
                },
              }
            );
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (property) {
      navigation.setOptions({ title: property.nickname ?? property.formattedAddress });
    }
  }, [property, navigation]);

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || !stopId) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      const { enqueueNote } = await import("@/utils/noteQueue");
      await enqueueNote(stopId, text);
      setNoteText("");
      Alert.alert(
        "Saved Offline",
        "Note saved locally. It will upload automatically when you're back online."
      );
      return;
    }
    addNote({ stopId, data: { note: text } }, {
      onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    });
  };

  const handleVoiceComplete = async (uri: string, durationSeconds: number) => {
    if (!stopId || Platform.OS === "web") return;
    setIsUploadingVoice(true);
    try {
      const { tryImmediateUpload } = await import("@/utils/voiceUploadQueue");
      const result = await tryImmediateUpload(uri, stopId, durationSeconds, () => {
        Alert.alert(
          "Saved Offline",
          "Voice note saved locally. It will upload automatically when you're back online."
        );
      });
      if (result === "uploaded") {
        refetch();
      }
    } catch {
      Alert.alert("Upload failed", "Could not save voice note.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const handleRatingChange = (field: RatingField, val: number) => {
    if (!stopId) return;
    void Haptics.selectionAsync();
    const patch: UpdateTourStopRequest = { [field]: val };
    updateStop({ stopId, data: patch });
  };

  const handleToggleFlag = (field: "followUpFlag" | "revisitFlag") => {
    if (!stopId || !stop) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const patch: UpdateTourStopRequest = { [field]: !stop[field] };
    updateStop({ stopId, data: patch });
  };

  const handleToggleTag = (tag: string) => {
    if (!stopId || !stop) return;
    void Haptics.selectionAsync();
    const current = stop.quickTags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateStop({ stopId, data: { quickTags: next } });
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: Semantic.grouped }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!stop) {
    return (
      <View style={[styles.center, { backgroundColor: Semantic.grouped }]}>
        <Text style={{ color: C.textSecondary }}>Stop not found.</Text>
      </View>
    );
  }

  const currentTags = stop.quickTags ?? [];

  const debriefIsProcessing =
    activeDebrief?.processingStatus === "pending" ||
    activeDebrief?.processingStatus === "transcribing" ||
    activeDebrief?.processingStatus === "scoring";

  const debriefCompleted = activeDebrief?.processingStatus === "completed";

  return (
    <View style={[styles.container, { backgroundColor: Semantic.grouped }]}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={isIOS ? "padding" : "height"}
      keyboardVerticalOffset={isIOS ? 0 : 20}
    >
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: isWeb ? 34 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {property && (
          <View style={[styles.propertyCard, { backgroundColor: C.primary }]}>
            <Text style={styles.propertyAddress} numberOfLines={2}>
              {property.nickname ?? property.formattedAddress}
            </Text>
            {property.nickname && property.formattedAddress && (
              <Text style={styles.propertyNickname} numberOfLines={2}>{property.formattedAddress}</Text>
            )}
            <View style={styles.propertyStats}>
              {property.listPrice && (
                <Text style={styles.propStat}>
                  ${(property.listPrice / 1000).toFixed(0)}k
                </Text>
              )}
              {property.beds && <Text style={styles.propStat}>{property.beds} bd</Text>}
              {property.baths && <Text style={styles.propStat}>{property.baths} ba</Text>}
              {property.squareFeet && (
                <Text style={styles.propStat}>{property.squareFeet.toLocaleString()} sqft</Text>
              )}
            </View>
            <View style={styles.statusRow}>
              <StatusChip status={stop.approvedStatus} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Pressable
            testID="toggle-visited-btn"
            onPress={handleToggleVisited}
            disabled={isTogglingVisited}
            style={({ pressed }) => [
              styles.visitedToggle,
              {
                backgroundColor: stop.visited ? C.green + "15" : C.card,
                borderColor: stop.visited ? C.green + "55" : C.border,
              },
              (pressed || isTogglingVisited) && { opacity: 0.7 },
            ]}
          >
            {isTogglingVisited ? (
              <ActivityIndicator color={stop.visited ? C.green : C.accent} size="small" />
            ) : isIOS ? (
              <SymbolView
                name={stop.visited ? "checkmark.circle.fill" : "circle"}
                tintColor={stop.visited ? C.green : C.textSecondary}
                size={20}
              />
            ) : (
              <Feather
                name={stop.visited ? "check-circle" : "circle"}
                size={20}
                color={stop.visited ? C.green : C.textSecondary}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.visitedToggleTitle, { color: stop.visited ? C.green : C.text }]}>
                {stop.visited ? "Marked visited" : "Mark visited"}
              </Text>
              <Text style={[styles.visitedToggleSub, { color: C.textSecondary }]}>
                {stop.visited
                  ? "Tap to undo if this was marked by mistake."
                  : "Confirms you showed this property to the buyer."}
              </Text>
            </View>
          </Pressable>
        </View>

        {showingRequest && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Listing Agent</Text>
            <View style={[styles.card, { backgroundColor: Semantic.groupedSurface }]}>
              {showingRequest.listingAgentName && (
                <InfoRow
                  label="Agent"
                  value={showingRequest.listingAgentName}
                  sfIcon="person"
                  featherIcon="user"
                  C={C}
                  isIOS={isIOS}
                />
              )}
              {showingRequest.brokerageName && (
                <InfoRow
                  label="Brokerage"
                  value={showingRequest.brokerageName}
                  sfIcon="building.2"
                  featherIcon="briefcase"
                  C={C}
                  isIOS={isIOS}
                />
              )}
              {showingRequest.phone && (
                <InfoRow
                  label="Phone"
                  value={showingRequest.phone}
                  sfIcon="phone"
                  featherIcon="phone"
                  C={C}
                  isIOS={isIOS}
                  onPress={() => {
                    import("@/lib/linking").then(({ openURL }) =>
                      openURL(`tel:${showingRequest.phone}`)
                    );
                  }}
                />
              )}
              {showingRequest.email && (
                <InfoRow
                  label="Email"
                  value={showingRequest.email}
                  sfIcon="envelope"
                  featherIcon="mail"
                  C={C}
                  isIOS={isIOS}
                  onPress={() => {
                    import("@/lib/linking").then(({ openURL }) =>
                      openURL(`mailto:${showingRequest.email}`)
                    );
                  }}
                />
              )}
              {showingRequest.notes && (
                <InfoRow
                  label="Notes"
                  value={showingRequest.notes}
                  sfIcon="note.text"
                  featherIcon="file-text"
                  C={C}
                  isIOS={isIOS}
                />
              )}
            </View>
          </View>
        )}

        {restrictionNote && (
          <View style={styles.section}>
            <Pressable
              onPress={() => setRestrictionsExpanded((v) => !v)}
              style={styles.sectionHeader}
              testID="restrictions-toggle"
            >
              <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Restrictions</Text>
              <View style={styles.sectionHeaderRight}>
                {!restrictionsExpanded && (
                  <Text style={[styles.sectionHint, { color: C.textTertiary }]}>Tap to expand</Text>
                )}
                {isIOS ? (
                  <SymbolView
                    name={restrictionsExpanded ? "chevron.up" : "chevron.down"}
                    tintColor={C.textTertiary}
                    size={14}
                  />
                ) : (
                  <Feather
                    name={restrictionsExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={C.textTertiary}
                  />
                )}
              </View>
            </Pressable>
            {restrictionsExpanded && (
              <View style={[styles.card, { backgroundColor: Semantic.groupedSurface }]}>
                {restrictionNote.gateCode && (
                  <InfoRow label="Gate Code" value={restrictionNote.gateCode} sfIcon="lock" featherIcon="lock" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.alarmInstructions && (
                  <InfoRow label="Alarm" value={restrictionNote.alarmInstructions} sfIcon="bell.slash" featherIcon="bell-off" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.petInstructions && (
                  <InfoRow label="Pets" value={restrictionNote.petInstructions} sfIcon="pawprint" featherIcon="heart" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.parkingInstructions && (
                  <InfoRow label="Parking" value={restrictionNote.parkingInstructions} sfIcon="car" featherIcon="truck" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.timeRestriction && (
                  <InfoRow label="Time Window" value={restrictionNote.timeRestriction} sfIcon="clock" featherIcon="clock" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.removeShoes && (
                  <FlagRow label="Remove shoes before entering" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.doNotUseBathroom && (
                  <FlagRow label="Do not use bathroom" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.occupied && (
                  <FlagRow label="Property is occupied" C={C} isIOS={isIOS} />
                )}
                {restrictionNote.freeTextNotes && (
                  <View style={styles.freeText}>
                    <Text style={[styles.freeTextContent, { color: C.textSecondary }]}>
                      {restrictionNote.freeTextNotes}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Ratings</Text>
          <View style={[styles.card, { backgroundColor: Semantic.groupedSurface }]}>
            {(
              [
                ["Overall Fit", "overallFitRating", stop.overallFitRating],
                ["Buyer Interest", "buyerInterest", stop.buyerInterest],
                ["Kitchen", "kitchenRating", stop.kitchenRating],
                ["Primary Suite", "primarySuiteRating", stop.primarySuiteRating],
                ["Backyard", "backyardRating", stop.backyardRating],
                ["Road Noise", "roadNoiseRating", stop.roadNoiseRating],
              ] as [string, RatingField, number | null | undefined][]
            ).map(([label, field, val]) => (
              <View key={field} style={styles.ratingRow}>
                <Text style={[styles.ratingLabel, { color: C.text }]}>{label}</Text>
                <StarRating
                  value={val}
                  onChange={(v) => handleRatingChange(field, v)}
                  size={20}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Flags</Text>
          <View style={styles.flagsRow}>
            <Pressable
              testID="follow-up-flag-btn"
              onPress={() => handleToggleFlag("followUpFlag")}
              style={({ pressed }) => [
                styles.flagToggle,
                {
                  backgroundColor: stop.followUpFlag ? C.amber + "22" : C.card,
                  borderColor: stop.followUpFlag ? C.amber : C.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isIOS ? (
                <SymbolView name="bookmark.fill" tintColor={stop.followUpFlag ? C.amber : C.textTertiary} size={16} />
              ) : (
                <Feather name="bookmark" size={16} color={stop.followUpFlag ? C.amber : C.textTertiary} />
              )}
              <Text style={[styles.flagLabel, { color: stop.followUpFlag ? C.amber : C.textSecondary }]}>
                Follow-up
              </Text>
            </Pressable>

            <Pressable
              testID="revisit-flag-btn"
              onPress={() => handleToggleFlag("revisitFlag")}
              style={({ pressed }) => [
                styles.flagToggle,
                {
                  backgroundColor: stop.revisitFlag ? C.accent + "22" : C.card,
                  borderColor: stop.revisitFlag ? C.accent : C.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              {isIOS ? (
                <SymbolView name="arrow.uturn.right.circle.fill" tintColor={stop.revisitFlag ? C.accent : C.textTertiary} size={16} />
              ) : (
                <Feather name="refresh-ccw" size={16} color={stop.revisitFlag ? C.accent : C.textTertiary} />
              )}
              <Text style={[styles.flagLabel, { color: stop.revisitFlag ? C.accent : C.textSecondary }]}>
                Revisit
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Quick Tags</Text>
          <View style={styles.tagWrap}>
            {QUICK_TAG_OPTIONS.map((tag) => {
              const active = currentTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  testID={`tag-${tag}`}
                  onPress={() => handleToggleTag(tag)}
                  style={({ pressed }) => [
                    styles.tagChip,
                    {
                      backgroundColor: active ? C.accent : C.card,
                      borderColor: active ? C.accent : C.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.tagLabel, { color: active ? "#FFF" : C.text }]}>
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => { voiceY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Notes</Text>
          {voiceNotes.length > 0 && (
            <View style={[styles.card, { backgroundColor: Semantic.groupedSurface, marginBottom: 12 }]}>
              {voiceNotes.map((vn, i) => {
                const isTypedOnly = !vn.fileUrl || vn.fileUrl === "";
                const isPendingTranscription = !isTypedOnly && vn.transcriptionStatus !== "completed" && vn.transcriptionStatus !== "failed";
                return (
                  <View key={vn.id} style={[styles.voiceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Semantic.opaqueSeparator as unknown as string }]}>
                    {isTypedOnly ? (
                      isIOS ? (
                        <SymbolView name="text.bubble" tintColor={C.textSecondary} size={16} />
                      ) : (
                        <Feather name="message-square" size={16} color={C.textSecondary} />
                      )
                    ) : (
                      isIOS ? (
                        <SymbolView name="waveform" tintColor={C.accent} size={16} />
                      ) : (
                        <Feather name="mic" size={16} color={C.accent} />
                      )
                    )}
                    <View style={styles.voiceContent}>
                      {isTypedOnly ? (
                        <Text style={[styles.voiceTranscript, { color: C.text }]}>
                          {vn.typedNote ?? ""}
                        </Text>
                      ) : (
                        <>
                          <Text style={[styles.voiceTime, { color: C.text }]}>
                            {vn.durationSeconds ? `${Math.round(vn.durationSeconds)}s voice recording` : "Voice note"}
                          </Text>
                          {vn.typedNote ? (
                            <Text style={[styles.voiceTranscript, { color: C.textSecondary }]}>
                              {vn.typedNote}
                            </Text>
                          ) : isPendingTranscription ? (
                            <Text style={[styles.voiceStatus, { color: C.accent }]}>
                              Transcribing…
                            </Text>
                          ) : vn.transcriptionStatus === "failed" ? (
                            <Text style={[styles.voiceStatus, { color: C.coral }]}>
                              Transcription unavailable
                            </Text>
                          ) : null}
                        </>
                      )}
                      <Text style={[styles.voiceStatus, { color: C.textTertiary }]}>
                        {new Date(vn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          <VoiceRecorder
            onRecordingComplete={handleVoiceComplete}
            isUploading={isUploadingVoice}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Add Text Note</Text>
          <View style={[styles.noteInput, { backgroundColor: Semantic.groupedSurface }]}>
            <TextInput
              testID="note-input"
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Type a note about this property…"
              placeholderTextColor={C.textTertiary}
              multiline
              style={[styles.noteTextField, { color: C.text }]}
            />
            <Pressable
              testID="add-note-btn"
              onPress={handleAddNote}
              disabled={!noteText.trim() || isAddingNote}
              style={({ pressed }) => [
                styles.addNoteBtn,
                { backgroundColor: C.accent },
                (!noteText.trim() || isAddingNote) && { opacity: 0.5 },
                pressed && { opacity: 0.75 },
              ]}
            >
              {isAddingNote ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : isIOS ? (
                <SymbolView name="paperplane.fill" tintColor="#FFF" size={16} />
              ) : (
                <Feather name="send" size={16} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>

        {summary && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>AI Summary</Text>
            <View style={[styles.card, { backgroundColor: Semantic.groupedSurface }]}>
              <Text style={[styles.summaryText, { color: C.text }]}>{summary.summaryText}</Text>
              {summary.positives && summary.positives.length > 0 && (
                <View style={styles.summaryList}>
                  <Text style={[styles.summaryListTitle, { color: C.green }]}>Positives</Text>
                  {summary.positives.map((p, i) => (
                    <Text key={i} style={[styles.summaryItem, { color: C.text }]}>+ {p}</Text>
                  ))}
                </View>
              )}
              {summary.negatives && summary.negatives.length > 0 && (
                <View style={styles.summaryList}>
                  <Text style={[styles.summaryListTitle, { color: C.coral }]}>Concerns</Text>
                  {summary.negatives.map((n, i) => (
                    <Text key={i} style={[styles.summaryItem, { color: C.text }]}>− {n}</Text>
                  ))}
                </View>
              )}
              {summary.questions && summary.questions.length > 0 && (
                <View style={styles.summaryList}>
                  <Text style={[styles.summaryListTitle, { color: C.accent }]}>Questions</Text>
                  {summary.questions.map((q, i) => (
                    <Text key={i} style={[styles.summaryItem, { color: C.text }]}>? {q}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Post-Showing Debrief Section */}
        {stop.visited && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                {isIOS ? (
                  <SymbolView name="waveform.badge.mic" tintColor={C.accent} size={16} />
                ) : (
                  <Feather name="mic" size={16} color={C.accent} />
                )}
                <Text style={[styles.sectionTitle, { color: C.text }]}>Post-Showing Debrief</Text>
              </View>
            </View>

            {!activeDebrief ? (
              <Pressable
                onPress={() => setShowDebriefSheet(true)}
                style={({ pressed }) => [
                  styles.debriefPrompt,
                  { backgroundColor: C.accent + "12", borderColor: C.accent + "30" },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {isIOS ? (
                  <SymbolView name="mic.circle.fill" tintColor={C.accent} size={28} />
                ) : (
                  <Feather name="mic" size={28} color={C.accent} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.debriefPromptTitle, { color: C.text }]}>Record Debrief</Text>
                  <Text style={[styles.debriefPromptSub, { color: C.textSecondary }]}>
                    Capture your impressions. AI will score fit and summarize.
                  </Text>
                </View>
                {isIOS ? (
                  <SymbolView name="chevron.right" tintColor={C.textTertiary} size={14} />
                ) : (
                  <Feather name="chevron-right" size={14} color={C.textTertiary} />
                )}
              </Pressable>
            ) : debriefIsProcessing ? (
              <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={styles.debriefProcessing}>
                  <ActivityIndicator color={C.accent} size="small" />
                  <Text style={[styles.debriefProcessingText, { color: C.textSecondary }]}>
                    {activeDebrief.processingStatus === "transcribing"
                      ? "Transcribing audio…"
                      : activeDebrief.processingStatus === "scoring"
                      ? "AI scoring in progress…"
                      : "Processing debrief…"}
                  </Text>
                </View>
              </View>
            ) : activeDebrief.processingStatus === "failed" ? (
              <View style={[styles.card, { backgroundColor: C.coral + "12", borderColor: C.coral + "30" }]}>
                <Text style={[styles.debriefFailed, { color: C.coral }]}>
                  Debrief processing failed. Transcript may not be available.
                </Text>
              </View>
            ) : debriefCompleted ? (
              <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                {activeDebrief.fitScore != null && (
                  <View style={styles.fitScoreRow}>
                    <FitScoreMeter score={activeDebrief.fitScore} />
                  </View>
                )}
                {activeDebrief.fitScoreVerdict && (
                  <Text style={[styles.debriefVerdict, { color: C.textSecondary }]}>
                    {activeDebrief.fitScoreVerdict}
                  </Text>
                )}
                {activeDebrief.fitScorePositives && activeDebrief.fitScorePositives.length > 0 && (
                  <View style={styles.summaryList}>
                    <Text style={[styles.summaryListTitle, { color: C.green }]}>Positives</Text>
                    {activeDebrief.fitScorePositives.map((p, i) => (
                      <Text key={i} style={[styles.summaryItem, { color: C.text }]}>+ {p}</Text>
                    ))}
                  </View>
                )}
                {activeDebrief.fitScoreNegatives && activeDebrief.fitScoreNegatives.length > 0 && (
                  <View style={styles.summaryList}>
                    <Text style={[styles.summaryListTitle, { color: C.coral }]}>Concerns</Text>
                    {activeDebrief.fitScoreNegatives.map((n, i) => (
                      <Text key={i} style={[styles.summaryItem, { color: C.text }]}>− {n}</Text>
                    ))}
                  </View>
                )}
                {activeDebrief.aiSummary && (
                  <View style={styles.summaryList}>
                    <Text style={[styles.summaryListTitle, { color: C.accent }]}>Summary</Text>
                    <Text style={[styles.debriefSummaryText, { color: C.textSecondary }]}>
                      {activeDebrief.aiSummary}
                    </Text>
                  </View>
                )}
                {activeDebrief.transcript && !activeDebrief.aiSummary && (
                  <View style={styles.summaryList}>
                    <Text style={[styles.summaryListTitle, { color: C.textSecondary }]}>Transcript</Text>
                    <Text style={[styles.debriefSummaryText, { color: C.textSecondary }]}>
                      "{activeDebrief.transcript}"
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <Pressable
            onPress={handleRemoveStop}
            disabled={isDeletingStop}
            style={({ pressed }) => [
              styles.removeBtn,
              { backgroundColor: C.coral + "12", borderColor: C.coral + "30" },
              pressed && { opacity: 0.7 },
            ]}
          >
            {isIOS ? (
              <SymbolView name="trash" tintColor={C.coral} size={16} />
            ) : (
              <Feather name="trash-2" size={16} color={C.coral} />
            )}
            <Text style={[styles.removeBtnLabel, { color: C.coral }]}>Remove from Tour</Text>
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>

    {showDebriefSheet && stopId && (
      <DebriefSheet
        stopId={stopId}
        onClose={() => {
          setShowDebriefSheet(false);
          refetch();
        }}
      />
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  propertyCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  propertyAddress: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
    marginBottom: 4,
  },
  propertyNickname: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  propertyStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  propStat: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusRow: { flexDirection: "row", gap: 8 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 80,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    width: 70,
    marginTop: 1,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  freeText: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  freeTextContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  ratingLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  flagsRow: {
    flexDirection: "row",
    gap: 10,
  },
  flagToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  flagLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  voiceContent: {
    flex: 1,
    gap: 3,
  },
  voiceTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  voiceTranscript: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  voiceStatus: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  noteInput: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 8,
    minHeight: 60,
  },
  noteTextField: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    minHeight: 44,
    maxHeight: 120,
  },
  addNoteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryList: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  summaryListTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Debrief styles
  debriefPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  debriefPromptTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  debriefPromptSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  debriefProcessing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  debriefProcessingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  debriefFailed: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    padding: 14,
  },
  fitScoreRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  debriefVerdict: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
  },
  debriefSummaryText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 4,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  removeBtnLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  visitedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  visitedToggleTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  visitedToggleSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
