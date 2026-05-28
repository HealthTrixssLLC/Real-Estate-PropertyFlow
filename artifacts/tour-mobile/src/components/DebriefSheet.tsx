import { Feather } from "@/lib/icon";
import type { Audio } from "@/lib/audio";
import * as Haptics from "@/lib/haptics";
import { SymbolView } from "@/lib/icon";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { uploadDebrief } from "@workspace/api-client-react";
import Colors from "@/constants/colors";

interface DebriefSheetProps {
  stopId: string;
  onClose: () => void;
}

const NUM_BARS = 5;
const BAR_PHASES = [0, 0.3, 0.6, 0.1, 0.5];

function WaveformBars({ isActive }: { isActive: boolean }) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.25))
  );
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      const loops = anims.current.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(BAR_PHASES[i] * 400),
            Animated.timing(anim, {
              toValue: 1,
              duration: 350,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.15,
              duration: 350,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        )
      );
      loopRef.current = Animated.parallel(loops);
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      anims.current.forEach((a) => {
        Animated.timing(a, {
          toValue: 0.25,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }

    return () => {
      loopRef.current?.stop();
    };
  }, [isActive]);

  return (
    <View style={styles.waveform}>
      {anims.current.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: isActive ? C.accent : C.border,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function DebriefSheet({ stopId, onClose }: DebriefSheetProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  const [phase, setPhase] = useState<"idle" | "recording" | "uploading" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recordingRef = useRef<InstanceType<typeof Audio.Recording> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRecording = phase === "recording";
  const isUploading = phase === "uploading";

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => { stopTimer(); }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") { setHasPermission(true); return true; }
    try {
      const { Audio } = await import("@/lib/audio");
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === "granted";
      setHasPermission(granted);
      if (!granted) {
        Alert.alert("Microphone Access", "Please allow microphone access in Settings to record a debrief.");
      }
      return granted;
    } catch { return false; }
  };

  const startRecording = async () => {
    if (Platform.OS === "web") { Alert.alert("Recording not available in web preview."); return; }
    const allowed = hasPermission ?? (await requestPermission());
    if (!allowed) return;
    try {
      const { Audio } = await import("@/lib/audio");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setPhase("recording");
      startTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stopAndUpload = async () => {
    if (!recordingRef.current) return;
    stopTimer();
    setPhase("uploading");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const { Audio } = await import("@/lib/audio");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      const duration = elapsed;
      recordingRef.current = null;

      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const fileResp = await fetch(uri);
        const blob = await fileResp.blob();
        await uploadDebrief(stopId, { audio: blob, durationSeconds: duration });
      }
      setPhase("done");
      setTimeout(() => onClose(), 800);
    } catch {
      setPhase("idle");
      Alert.alert("Upload failed", "Could not save debrief. Please try again.");
    }
  };

  const handleSkip = async () => {
    setPhase("uploading");
    try {
      await uploadDebrief(stopId, {});
    } catch {
      // Skip silently — non-critical
    }
    setPhase("done");
    setTimeout(() => onClose(), 400);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.handle, { backgroundColor: C.border }]} />

        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: C.accent + "18" }]}>
            {isIOS ? (
              <SymbolView name="waveform.badge.mic" tintColor={C.accent} size={28} />
            ) : (
              <Feather name="mic" size={28} color={C.accent} />
            )}
          </View>
          <Text style={[styles.title, { color: C.text }]}>Post-Showing Debrief</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>
            {phase === "done"
              ? "Debrief saved — AI scoring in progress"
              : "How did this showing go? Record a quick voice note (30–120 sec)"}
          </Text>
        </View>

        <WaveformBars isActive={isRecording} />

        {isRecording && (
          <Text style={[styles.timer, { color: C.accent }]}>{formatTime(elapsed)}</Text>
        )}

        {phase === "done" ? (
          <View style={[styles.doneRow, { backgroundColor: C.green + "18", borderRadius: 16, padding: 16 }]}>
            {isIOS ? (
              <SymbolView name="checkmark.circle.fill" tintColor={C.green} size={28} />
            ) : (
              <Feather name="check-circle" size={28} color={C.green} />
            )}
            <Text style={[styles.doneText, { color: C.green }]}>Debrief saved!</Text>
          </View>
        ) : isUploading ? (
          <View style={styles.actionArea}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={[styles.uploadingText, { color: C.textSecondary }]}>Saving debrief…</Text>
          </View>
        ) : (
          <View style={styles.actionArea}>
            <Pressable
              onPress={isRecording ? stopAndUpload : startRecording}
              style={({ pressed }) => [
                styles.recordBtn,
                { backgroundColor: isRecording ? C.coral : C.accent },
                pressed && { opacity: 0.85 },
              ]}
            >
              {isIOS ? (
                <SymbolView
                  name={isRecording ? "stop.circle.fill" : "mic.circle.fill"}
                  tintColor="#FFF"
                  size={24}
                />
              ) : (
                <Feather name={isRecording ? "square" : "mic"} size={24} color="#FFF" />
              )}
              <Text style={styles.recordBtnLabel}>
                {isRecording ? `Stop Recording  ${formatTime(elapsed)}` : "Start Recording"}
              </Text>
            </Pressable>

            {!isRecording && (
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [
                  styles.skipBtn,
                  { borderColor: C.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.skipLabel, { color: C.textSecondary }]}>Skip for now</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={{ height: insets.bottom + 16 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 24,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 64,
    marginBottom: 8,
  },
  bar: {
    width: 6,
    height: 48,
    borderRadius: 3,
  },
  timer: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 24,
    letterSpacing: 1,
  },
  actionArea: {
    width: "100%",
    alignItems: "center",
    gap: 14,
    marginTop: 16,
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    justifyContent: "center",
  },
  recordBtnLabel: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  skipBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  skipLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  doneText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  uploadingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 8,
  },
});
