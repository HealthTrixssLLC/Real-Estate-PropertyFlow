import { useListTours, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { router } from "@/lib/navigation";
import { SymbolView } from "@/lib/icon";
import { Feather } from "@/lib/icon";
import * as Haptics from "@/lib/haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { TourCard } from "@/components/TourCard";
import {
  Card,
  EmptyState,
  ListGroup,
  ScreenHeader,
  SyncStatusPill,
} from "@/components/ui";
import { Brand, Radii, Spacing, useTheme, sem } from "@/theme";

export default function TodayScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const { data: authData } = useGetCurrentAuthUser();
  const { data, isLoading, refetch, isRefetching } = useListTours();

  const tours = data?.tours ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);

  const dayOf = (s: string) => {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const activeTour =
    tours.find((x) => x.status === "active") ?? null;

  const todayTours = tours.filter(
    (x) => dayOf(x.date) === today.getTime() && x.status !== "completed" && x.status !== "cancelled"
  );
  const upcomingThisWeek = tours
    .filter((x) => {
      const d = dayOf(x.date);
      return d > today.getTime() && d <= sevenDays.getTime() && x.status !== "cancelled" && x.status !== "completed";
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completedToday = tours.filter(
    (x) => dayOf(x.date) === today.getTime() && x.status === "completed"
  );

  const firstName = authData?.user?.firstName ?? "Agent";
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Good evening"
      : hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : "Good evening";

  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <OnboardingOverlay />
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
          title={greeting}
          subtitle={`${firstName} · ${todayLabel}`}
          right={<SyncStatusPill />}
        />

        {activeTour && (
          <Pressable
            testID="resume-tour-btn"
            accessibilityRole="button"
            accessibilityLabel={`Resume active tour ${activeTour.title}`}
            onPress={() => {
              if (t.isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/tour/${activeTour.id}`);
            }}
            style={({ pressed }) => [
              styles.hero,
              { backgroundColor: Brand.teal, opacity: pressed ? 0.94 : 1 },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <View style={styles.heroPulse} />
                <Text style={styles.heroBadgeText}>TOUR IN PROGRESS</Text>
              </View>
              {t.isIOS ? (
                <SymbolView
                  name="arrow.up.right.circle.fill"
                  tintColor="#FFFFFFE8"
                  size={26}
                />
              ) : (
                <Feather name="arrow-up-right" size={22} color="#FFFFFFE8" />
              )}
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {activeTour.title}
            </Text>
            <View style={styles.heroStats}>
              <Stat
                icon="house"
                value={`${activeTour.stopCount ?? 0}`}
                label="stops"
                t={t}
              />
              {(activeTour.approvedCount ?? 0) > 0 && (
                <Stat
                  icon="checkmark.circle"
                  value={`${activeTour.approvedCount}`}
                  label="approved"
                  t={t}
                />
              )}
              {(activeTour.pendingShowingsCount ?? 0) > 0 && (
                <Stat
                  icon="clock"
                  value={`${activeTour.pendingShowingsCount}`}
                  label="pending"
                  t={t}
                />
              )}
            </View>
            <Text style={styles.heroCta}>Resume tour →</Text>
          </Pressable>
        )}

        {isLoading && tours.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Brand.teal} />
          </View>
        ) : null}

        {todayTours.length > 0 && (
          <ListGroup header={`Today · ${todayLabel}`}>
            {todayTours.map((tour, i) => (
              <TourCard
                key={tour.id}
                tour={tour}
                buyerName={tour.buyerName ?? undefined}
                isActive={tour.status === "active"}
                isFirst={i === 0}
                isLast={i === todayTours.length - 1}
              />
            ))}
          </ListGroup>
        )}

        {upcomingThisWeek.length > 0 && (
          <ListGroup header="Coming up this week">
            {upcomingThisWeek.slice(0, 5).map((tour, i, arr) => (
              <TourCard
                key={tour.id}
                tour={tour}
                buyerName={tour.buyerName ?? undefined}
                isFirst={i === 0}
                isLast={i === arr.length - 1}
              />
            ))}
          </ListGroup>
        )}

        {completedToday.length > 0 && (
          <ListGroup header={`Completed today · ${completedToday.length}`}>
            {completedToday.map((tour, i) => (
              <TourCard
                key={tour.id}
                tour={tour}
                buyerName={tour.buyerName ?? undefined}
                isFirst={i === 0}
                isLast={i === completedToday.length - 1}
              />
            ))}
          </ListGroup>
        )}

        {!isLoading &&
          !activeTour &&
          todayTours.length === 0 &&
          upcomingThisWeek.length === 0 &&
          completedToday.length === 0 && (
            <View style={{ paddingHorizontal: Spacing.lg }}>
              <Card>
                <EmptyState
                  sfSymbol="calendar.badge.checkmark"
                  featherIcon="calendar"
                  title="No tours scheduled"
                  message="When you publish a tour on the dashboard it shows up here so you can run it in the field."
                />
              </Card>
            </View>
          )}
      </ScrollView>
    </>
  );
}

function Stat({
  icon,
  value,
  label,
  t,
}: {
  icon: string;
  value: string;
  label: string;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.stat}>
      {t.isIOS ? (
        <SymbolView name={icon as any} tintColor="#FFFFFFCC" size={13} />
      ) : (
        <Feather name="circle" size={11} color="#FFFFFFCC" />
      )}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    shadowColor: Brand.teal,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  heroBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: Spacing.md,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  statValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  statLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "500",
  },
  heroCta: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  loader: { paddingVertical: 40, alignItems: "center" },
});
