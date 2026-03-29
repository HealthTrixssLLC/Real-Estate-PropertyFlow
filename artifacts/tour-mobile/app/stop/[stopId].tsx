import { Feather } from "@expo/vector-icons";
import {
  useGetTourStop,
  useAddStopNote,
  useUpdateTourStop,
  useDeleteTourStop,
  useGetTour,
  getGetTourStopQueryKey,
  getGetTourQueryKey,
} from "@workspace/api-client-react";
import type { UpdateTourStopRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
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
import Colors from "@/constants/colors";

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
  const scrollRef = useRef<ScrollView>(null);
  const voiceY = useRef(0);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useGetTourStop(stopId ?? "", {
    query: { queryKey: getGetTourStopQueryKey(stopId ?? ""), enabled: !!stopId },
  });

  const { mutate: addNote, isPending: isAddingNote } = useAddStopNote({
    mutation: { onSuccess: () => { setNoteText(""); refetch(); } },
  });

  const { mutate: updateStop } = useUpdateTourStop({
    mutation: { onSuccess: () => refetch() },
  });

  const { mutate: deleteStop, isPending: isDeletingStop } = useDeleteTourStop();

  const stop = data?.stop;
  const property = data?.property;
  const showingRequest = data?.showingRequest;
  const restrictionNote = data?.restrictionNote;
  const voiceNotes = data?.voiceNotes ?? [];
  const summary = data?.propertySummary;

  const { data: tourData } = useGetTour(stop?.tourId ?? "", {
    query: { enabled: !!stop?.tourId },
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
    addNote({ stopId, data: { note: text } });
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
    const patch: UpdateTourStopRequest = { [field]: val };
    updateStop({ stopId, data: patch });
  };

  const handleToggleFlag = (field: "followUpFlag" | "revisitFlag") => {
    if (!stopId || !stop) return;
    const patch: UpdateTourStopRequest = { [field]: !stop[field] };
    updateStop({ stopId, data: patch });
  };

  const handleToggleTag = (tag: string) => {
    if (!stopId || !stop) return;
    const current = stop.quickTags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateStop({ stopId, data: { quickTags: next } });
  };

  const topPad = isWeb ? 67 : 0;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!stop) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>Stop not found.</Text>
      </View>
    );
  }

  const currentTags = stop.quickTags ?? [];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={isIOS ? "padding" : "height"}
      keyboardVerticalOffset={isIOS ? 0 : 20}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {property && (
          <View style={[styles.propertyCard, { backgroundColor: C.primary }]}>
            <Text style={styles.propertyAddress} numberOfLines={2}>
              {property.formattedAddress}
            </Text>
            {property.nickname && (
              <Text style={styles.propertyNickname}>{property.nickname}</Text>
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

        {showingRequest && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Listing Agent</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
                    import("expo-linking").then(({ openURL }) =>
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
                    import("expo-linking").then(({ openURL }) =>
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
              <Text style={[styles.sectionTitle, { color: C.text }]}>Restrictions</Text>
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
              <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>Ratings</Text>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>Flags</Text>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>Quick Tags</Text>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>Notes</Text>
          {voiceNotes.length > 0 && (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 12 }]}>
              {voiceNotes.map((vn, i) => {
                const isTypedOnly = !vn.fileUrl || vn.fileUrl === "";
                const isPendingTranscription = !isTypedOnly && vn.transcriptionStatus !== "completed" && vn.transcriptionStatus !== "failed";
                return (
                  <View key={vn.id} style={[styles.voiceRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
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
          <Text style={[styles.sectionTitle, { color: C.text }]}>Add Text Note</Text>
          <View style={[styles.noteInput, { backgroundColor: C.card, borderColor: C.border }]}>
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
            <Text style={[styles.sectionTitle, { color: C.text }]}>AI Summary</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.summaryText, { color: C.text }]}>{summary.summaryText}</Text>
              {summary.positives && summary.positives.length > 0 && (
                <View style={styles.summaryList}>
                  <Text style={[styles.summaryListTitle, { color: C.green }]}>Positives</Text>
                  {summary.positives.map((p, i) => (
                    <Text key={i} style={[styles.summaryListItem, { color: C.textSecondary }]}>• {p}</Text>
                  ))}
                </View>
              )}
              {summary.negatives && summary.negatives.length > 0 && (
                <View style={styles.summaryList}>
                  <Text style={[styles.summaryListTitle, { color: C.coral }]}>Concerns</Text>
                  {summary.negatives.map((n, i) => (
                    <Text key={i} style={[styles.summaryListItem, { color: C.textSecondary }]}>• {n}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {stop.skipped && (
          <View style={[styles.skippedBanner, { backgroundColor: C.surfaceAlt }]}>
            {isIOS ? (
              <SymbolView name="forward.fill" tintColor={C.textSecondary} size={20} />
            ) : (
              <Feather name="skip-forward" size={20} color={C.textSecondary} />
            )}
            <View>
              <Text style={[styles.skippedTitle, { color: C.text }]}>Stop was skipped</Text>
              {stop.skipReason && (
                <Text style={[styles.skippedReason, { color: C.textSecondary }]}>
                  {stop.skipReason.replace(/_/g, " ")}
                </Text>
              )}
            </View>
          </View>
        )}

        {tourStatus !== undefined && tourStatus !== "published" && (
          <View style={styles.section}>
            <Pressable
              testID="remove-stop-btn"
              onPress={handleRemoveStop}
              disabled={isDeletingStop}
              style={({ pressed }) => [
                styles.removeStopBtn,
                { borderColor: C.coral, backgroundColor: pressed ? C.coral + "15" : "transparent" },
                isDeletingStop && { opacity: 0.5 },
              ]}
            >
              {isIOS ? (
                <SymbolView name="trash" tintColor={C.coral} size={18} />
              ) : (
                <Feather name="trash-2" size={18} color={C.coral} />
              )}
              <Text style={[styles.removeStopLabel, { color: C.coral }]}>
                {isDeletingStop ? "Removing…" : "Remove Stop"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>

    {!isWeb && (
      <Pressable
        testID="floating-mic-btn"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          scrollRef.current?.scrollTo({ y: voiceY.current, animated: true });
        }}
        style={[
          styles.fab,
          { backgroundColor: isUploadingVoice ? C.textTertiary : C.accent, bottom: insets.bottom + 20 },
        ]}
      >
        {isUploadingVoice ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : isIOS ? (
          <SymbolView name="mic.fill" tintColor="#FFF" size={22} />
        ) : (
          <Feather name="mic" size={22} color="#FFF" />
        )}
      </Pressable>
    )}
    </View>
  );
}

type ColorScheme = (typeof Colors)["light"];

function InfoRow({
  label,
  value,
  sfIcon,
  featherIcon,
  onPress,
  C,
  isIOS,
}: {
  label: string;
  value: string;
  sfIcon?: SFSymbol;
  featherIcon?: ComponentProps<typeof Feather>["name"];
  onPress?: () => void;
  C: ColorScheme;
  isIOS: boolean;
}) {
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        {sfIcon && isIOS ? (
          <SymbolView name={sfIcon} tintColor={C.textTertiary} size={14} />
        ) : featherIcon ? (
          <Feather name={featherIcon as ComponentProps<typeof Feather>["name"]} size={14} color={C.textTertiary} />
        ) : null}
        <Text style={[styles.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      </View>
      <Text
        style={[styles.infoValue, { color: onPress ? C.accent : C.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function FlagRow({ label, C, isIOS }: { label: string; C: ColorScheme; isIOS: boolean }) {
  return (
    <View style={[styles.infoRow, styles.flagInfoRow]}>
      {isIOS ? (
        <SymbolView name="exclamationmark.triangle" tintColor={C.amber} size={14} />
      ) : (
        <Feather name="alert-triangle" size={14} color={C.amber} />
      )}
      <Text style={[styles.infoLabel, { color: C.text }]}>{label}</Text>
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
  content: { paddingHorizontal: 20 },
  propertyCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  propertyAddress: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    marginBottom: 4,
  },
  propertyNickname: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  propertyStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  propStat: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  statusRow: {
    flexDirection: "row",
  },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
    gap: 8,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 80,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    textAlign: "right",
  },
  flagInfoRow: {
    justifyContent: "flex-start",
    gap: 8,
  },
  freeText: {
    padding: 14,
  },
  freeTextContent: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  ratingLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  flagLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  voiceContent: { flex: 1 },
  voiceTime: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  voiceTranscript: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  voiceStatus: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  noteInput: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  noteTextField: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 44,
    maxHeight: 120,
  },
  addNoteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    padding: 14,
  },
  summaryList: {
    padding: 14,
    paddingTop: 0,
    gap: 4,
  },
  summaryListTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  summaryListItem: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  skippedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  skippedTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  skippedReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
    marginTop: 2,
  },
  removeStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  removeStopLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
