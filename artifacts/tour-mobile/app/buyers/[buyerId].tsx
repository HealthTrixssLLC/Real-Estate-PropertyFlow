import { Feather } from "@expo/vector-icons";
import {
  useGetBuyerDetail,
  getGetBuyerDetailQueryKey,
} from "@workspace/api-client-react";
import type { BuyerDetailStop, BuyerDetailTour } from "@workspace/api-client-react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
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

import { StarRating } from "@/components/StarRating";
import { StatusChip } from "@/components/StatusChip";
import Colors from "@/constants/colors";

function StarDisplay({ value }: { value: number | null | undefined }) {
  if (!value) {
    return null;
  }
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n}>
          {Platform.OS === "ios" ? (
            <SymbolView
              name={n <= value ? "star.fill" : "star"}
              tintColor={n <= value ? "#F5A623" : C.border}
              size={12}
            />
          ) : (
            <Feather
              name="star"
              size={12}
              color={n <= value ? "#F5A623" : C.border}
            />
          )}
        </View>
      ))}
      <Text style={[starStyles.label, { color: C.textSecondary }]}>
        {value}/5
      </Text>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
});

type ChipStatus = React.ComponentProps<typeof StatusChip>["status"];

function VisitBadge({ stop }: { stop: BuyerDetailStop }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  if (stop.skipped) {
    return (
      <View style={[badge.chip, { backgroundColor: "#FFF3E0" }]}>
        <Text style={[badge.label, { color: "#E87A2A" }]}>Skipped</Text>
      </View>
    );
  }
  if (stop.visited) {
    return (
      <View style={[badge.chip, { backgroundColor: "#E8F8EC" }]}>
        <Text style={[badge.label, { color: "#27C06B" }]}>Visited</Text>
      </View>
    );
  }
  return (
    <View style={[badge.chip, { backgroundColor: C.surfaceAlt }]}>
      <Text style={[badge.label, { color: C.textTertiary }]}>Not Visited</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});

function StopCard({ stop }: { stop: BuyerDetailStop }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";
  const [expanded, setExpanded] = useState(false);

  const hasRatings =
    stop.overallFitRating ||
    stop.buyerInterest ||
    stop.kitchenRating ||
    stop.primarySuiteRating ||
    stop.backyardRating ||
    stop.roadNoiseRating;

  const hasTags = stop.quickTags && stop.quickTags.length > 0;
  const hasComments = stop.comments && stop.comments.length > 0;
  const hasFlags = stop.followUpFlag || stop.revisitFlag;

  return (
    <View style={[stopStyles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [stopStyles.header, pressed && { opacity: 0.8 }]}
      >
        <View style={[stopStyles.seqBadge, { backgroundColor: C.accent + "22" }]}>
          <Text style={[stopStyles.seqText, { color: C.accent }]}>{stop.sequence}</Text>
        </View>
        <View style={stopStyles.headerContent}>
          <Text style={[stopStyles.address, { color: C.text }]} numberOfLines={1}>
            {stop.propertyNickname ?? stop.formattedAddress}
          </Text>
          {stop.propertyNickname && (
            <Text style={[stopStyles.subAddr, { color: C.textTertiary }]} numberOfLines={1}>
              {stop.formattedAddress}
            </Text>
          )}
          <View style={stopStyles.metaRow}>
            <VisitBadge stop={stop} />
            {stop.overallFitRating != null && (
              <View style={stopStyles.ratingPill}>
                {isIOS ? (
                  <SymbolView name="star.fill" tintColor="#F5A623" size={11} />
                ) : (
                  <Feather name="star" size={11} color="#F5A623" />
                )}
                <Text style={[stopStyles.ratingPillText, { color: C.textSecondary }]}>
                  {stop.overallFitRating}/5
                </Text>
              </View>
            )}
            {stop.followUpFlag && (
              isIOS ? (
                <SymbolView name="bookmark.fill" tintColor={C.amber} size={13} />
              ) : (
                <Feather name="bookmark" size={13} color={C.amber} />
              )
            )}
            {stop.revisitFlag && (
              isIOS ? (
                <SymbolView name="arrow.uturn.right.circle.fill" tintColor={C.accent} size={13} />
              ) : (
                <Feather name="refresh-ccw" size={13} color={C.accent} />
              )
            )}
          </View>
        </View>
        {isIOS ? (
          <SymbolView
            name={expanded ? "chevron.up" : "chevron.down"}
            tintColor={C.textTertiary}
            size={14}
          />
        ) : (
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={C.textTertiary}
          />
        )}
      </Pressable>

      {expanded && (
        <View style={[stopStyles.detail, { borderTopColor: C.border }]}>
          {stop.showingStatus && stop.showingStatus !== "not_requested" && (
            <View style={stopStyles.detailRow}>
              <Text style={[stopStyles.detailLabel, { color: C.textSecondary }]}>Showing</Text>
              <StatusChip
                status={stop.showingStatus as ChipStatus}
                small
              />
            </View>
          )}

          {hasRatings && (
            <View style={stopStyles.section}>
              <Text style={[stopStyles.sectionTitle, { color: C.textSecondary }]}>Ratings</Text>
              {(
                [
                  ["Overall Fit", stop.overallFitRating],
                  ["Buyer Interest", stop.buyerInterest],
                  ["Kitchen", stop.kitchenRating],
                  ["Primary Suite", stop.primarySuiteRating],
                  ["Backyard", stop.backyardRating],
                  ["Road Noise", stop.roadNoiseRating],
                ] as [string, number | null | undefined][]
              )
                .filter(([, v]) => v != null)
                .map(([label, val]) => (
                  <View key={label} style={stopStyles.ratingRow}>
                    <Text style={[stopStyles.ratingLabel, { color: C.text }]}>{label}</Text>
                    <StarDisplay value={val} />
                  </View>
                ))}
            </View>
          )}

          {hasFlags && (
            <View style={stopStyles.flagsRow}>
              {stop.followUpFlag && (
                <View style={[stopStyles.flagChip, { backgroundColor: C.amber + "22", borderColor: C.amber }]}>
                  {isIOS ? (
                    <SymbolView name="bookmark.fill" tintColor={C.amber} size={13} />
                  ) : (
                    <Feather name="bookmark" size={13} color={C.amber} />
                  )}
                  <Text style={[stopStyles.flagLabel, { color: C.amber }]}>Follow-up</Text>
                </View>
              )}
              {stop.revisitFlag && (
                <View style={[stopStyles.flagChip, { backgroundColor: C.accent + "22", borderColor: C.accent }]}>
                  {isIOS ? (
                    <SymbolView name="arrow.uturn.right.circle.fill" tintColor={C.accent} size={13} />
                  ) : (
                    <Feather name="refresh-ccw" size={13} color={C.accent} />
                  )}
                  <Text style={[stopStyles.flagLabel, { color: C.accent }]}>Revisit</Text>
                </View>
              )}
            </View>
          )}

          {hasTags && (
            <View style={stopStyles.section}>
              <Text style={[stopStyles.sectionTitle, { color: C.textSecondary }]}>Tags</Text>
              <View style={stopStyles.tagsWrap}>
                {stop.quickTags!.map((tag) => (
                  <View
                    key={tag}
                    style={[stopStyles.tag, { backgroundColor: C.accent + "18", borderColor: C.accent + "44" }]}
                  >
                    <Text style={[stopStyles.tagText, { color: C.accent }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {stop.skipped && stop.skipReason && (
            <View style={stopStyles.section}>
              <Text style={[stopStyles.sectionTitle, { color: C.textSecondary }]}>Skip Reason</Text>
              <Text style={[stopStyles.skipText, { color: C.textSecondary }]}>
                {stop.skipReason.replace(/_/g, " ")}
                {stop.skipNotes ? ` — ${stop.skipNotes}` : ""}
              </Text>
            </View>
          )}

          {hasComments && (
            <View style={stopStyles.section}>
              <Text style={[stopStyles.sectionTitle, { color: C.textSecondary }]}>Notes</Text>
              {(stop.comments ?? []).map((c) => (
                <View key={c.id} style={[stopStyles.comment, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                  {c.isVoiceNote ? (
                    isIOS ? (
                      <SymbolView name="mic.fill" tintColor={C.accent} size={13} />
                    ) : (
                      <Feather name="mic" size={13} color={C.accent} />
                    )
                  ) : (
                    isIOS ? (
                      <SymbolView name="text.bubble" tintColor={C.textTertiary} size={13} />
                    ) : (
                      <Feather name="message-square" size={13} color={C.textTertiary} />
                    )
                  )}
                  <Text style={[stopStyles.commentText, { color: C.text }]}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          {!hasRatings && !hasFlags && !hasTags && !hasComments && (
            <Text style={[stopStyles.emptyDetail, { color: C.textTertiary }]}>
              No detailed data recorded.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const stopStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  seqBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  seqText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  headerContent: {
    flex: 1,
    gap: 3,
  },
  address: {
    fontSize: 14,
    fontWeight: "600",
  },
  subAddr: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingPillText: {
    fontSize: 11,
  },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingTop: 10,
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingLabel: {
    fontSize: 13,
  },
  flagsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  flagLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  skipText: {
    fontSize: 13,
    textTransform: "capitalize",
  },
  comment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  commentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyDetail: {
    fontSize: 12,
    fontStyle: "italic",
  },
});

function TourSection({ tour }: { tour: BuyerDetailTour }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";
  const [expanded, setExpanded] = useState(true);

  const visited = tour.stops.filter((s) => s.visited && !s.skipped).length;
  const skipped = tour.stops.filter((s) => s.skipped).length;

  return (
    <View style={[tourStyles.container, { borderColor: C.border }]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          tourStyles.header,
          { backgroundColor: C.surfaceAlt },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={tourStyles.headerContent}>
          <View style={tourStyles.titleRow}>
            <Text style={[tourStyles.title, { color: C.text }]} numberOfLines={1}>
              {tour.title}
            </Text>
            <StatusChip status={tour.status as ChipStatus} small />
          </View>
          <View style={tourStyles.meta}>
            <View style={tourStyles.metaItem}>
              {isIOS ? (
                <SymbolView name="calendar" tintColor={C.textTertiary} size={12} />
              ) : (
                <Feather name="calendar" size={12} color={C.textTertiary} />
              )}
              <Text style={[tourStyles.metaText, { color: C.textSecondary }]}>{tour.date}</Text>
            </View>
            <View style={tourStyles.metaItem}>
              {isIOS ? (
                <SymbolView name="house" tintColor={C.textTertiary} size={12} />
              ) : (
                <Feather name="home" size={12} color={C.textTertiary} />
              )}
              <Text style={[tourStyles.metaText, { color: C.textSecondary }]}>
                {tour.stops.length} stop{tour.stops.length !== 1 ? "s" : ""}
                {visited > 0 ? ` · ${visited} visited` : ""}
                {skipped > 0 ? ` · ${skipped} skipped` : ""}
              </Text>
            </View>
          </View>
        </View>
        {isIOS ? (
          <SymbolView
            name={expanded ? "chevron.up" : "chevron.down"}
            tintColor={C.textTertiary}
            size={14}
          />
        ) : (
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={C.textTertiary}
          />
        )}
      </Pressable>

      {expanded && (
        <View style={[tourStyles.stops, { backgroundColor: C.background }]}>
          {tour.stops.length === 0 ? (
            <Text style={[tourStyles.emptyStops, { color: C.textTertiary }]}>No stops on this tour.</Text>
          ) : (
            tour.stops.map((stop) => <StopCard key={stop.id} stop={stop} />)
          )}
        </View>
      )}
    </View>
  );
}

const tourStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  stops: {
    padding: 10,
  },
  emptyStops: {
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});

export default function BuyerDetailScreen() {
  const { buyerId } = useLocalSearchParams<{ buyerId: string }>();
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const navigation = useNavigation();

  const { data, isLoading } = useGetBuyerDetail(buyerId ?? "", {
    query: {
      queryKey: getGetBuyerDetailQueryKey(buyerId ?? ""),
      enabled: !!buyerId,
    },
  });

  const buyer = data?.buyer;
  const tours = data?.tours ?? [];

  useEffect(() => {
    if (buyer) {
      navigation.setOptions({ title: buyer.name });
    }
  }, [buyer, navigation]);

  const topPad = isWeb ? 67 : 0;

  if (isLoading) {
    return (
      <View style={[screenStyles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!buyer) {
    return (
      <View style={[screenStyles.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>Buyer not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.background }}
      contentContainerStyle={[
        screenStyles.content,
        { paddingTop: topPad + 16, paddingBottom: isWeb ? 34 : insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[screenStyles.profileCard, { backgroundColor: C.primary }]}>
        <View style={[screenStyles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={screenStyles.avatarText}>{buyer.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={screenStyles.buyerName}>{buyer.name}</Text>
        <Text style={screenStyles.buyerMeta}>
          {tours.length} tour{tours.length !== 1 ? "s" : ""} ·{" "}
          {tours.reduce((a, t) => a + t.stops.length, 0)} total stops
        </Text>
        {buyer.email && (
          <View style={screenStyles.contactRow}>
            {isIOS ? (
              <SymbolView name="envelope" tintColor="rgba(255,255,255,0.8)" size={13} />
            ) : (
              <Feather name="mail" size={13} color="rgba(255,255,255,0.8)" />
            )}
            <Text style={screenStyles.contactText}>{buyer.email}</Text>
          </View>
        )}
        {buyer.phone && (
          <View style={screenStyles.contactRow}>
            {isIOS ? (
              <SymbolView name="phone" tintColor="rgba(255,255,255,0.8)" size={13} />
            ) : (
              <Feather name="phone" size={13} color="rgba(255,255,255,0.8)" />
            )}
            <Text style={screenStyles.contactText}>{buyer.phone}</Text>
          </View>
        )}
      </View>

      {buyer.notes && (
        <View style={[screenStyles.notesCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={screenStyles.notesHeader}>
            {isIOS ? (
              <SymbolView name="note.text" tintColor={C.textTertiary} size={14} />
            ) : (
              <Feather name="file-text" size={14} color={C.textTertiary} />
            )}
            <Text style={[screenStyles.noteTitle, { color: C.textSecondary }]}>Preference Notes</Text>
          </View>
          <Text style={[screenStyles.notesText, { color: C.text }]}>{buyer.notes}</Text>
        </View>
      )}

      {tours.length === 0 ? (
        <View style={[screenStyles.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          {isIOS ? (
            <SymbolView name="house" tintColor={C.textTertiary} size={40} />
          ) : (
            <Feather name="home" size={40} color={C.textTertiary} />
          )}
          <Text style={[screenStyles.emptyTitle, { color: C.text }]}>No tours yet</Text>
          <Text style={[screenStyles.emptyText, { color: C.textSecondary }]}>
            This buyer hasn't been added to any tours.
          </Text>
        </View>
      ) : (
        <View>
          <Text style={[screenStyles.sectionHeader, { color: C.text }]}>Tour History</Text>
          {tours.map((tour) => (
            <TourSection key={tour.id} tour={tour} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16 },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  buyerName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  buyerMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  notesCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 220,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },
});
