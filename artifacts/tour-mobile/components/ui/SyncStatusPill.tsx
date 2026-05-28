import NetInfo from "@react-native-community/netinfo";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Radii, Spacing, useTheme, sem } from "@/theme";
import { getPendingCount as getQueuedVoiceCount } from "@/utils/voiceUploadQueue";
import { getPendingNotes } from "@/utils/noteQueue";

export function SyncStatusPill() {
  const t = useTheme();
  const [online, setOnline] = useState<boolean | null>(null);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => setOnline(s.isConnected && s.isInternetReachable !== false));
    return () => sub();
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [v, notes] = await Promise.all([getQueuedVoiceCount(), getPendingNotes()]);
        if (alive) setQueued(v + notes.length);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Idle / online with nothing queued — render nothing (no chrome noise).
  if (online !== false && queued === 0) return null;

  const offline = online === false;
  const color = offline ? (sem("systemOrange") as string) : t.Brand.teal;
  const bg = offline ? "rgba(255,149,0,0.14)" : t.Brand.teal + "1F";
  const label = offline
    ? queued > 0
      ? `Offline · ${queued} queued`
      : "Offline"
    : `Syncing ${queued}`;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderRadius: Radii.pill }]}>
      {offline ? (
        t.isIOS ? (
          <SymbolView name="wifi.slash" tintColor={color} size={11} />
        ) : (
          <Feather name="wifi-off" size={11} color={color} />
        )
      ) : (
        <ActivityIndicator size="small" color={color} />
      )}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.1 },
});
