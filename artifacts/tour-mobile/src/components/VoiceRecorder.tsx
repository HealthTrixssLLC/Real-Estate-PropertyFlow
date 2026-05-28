import { Feather } from "@/lib/icon";
import type { Audio } from "@/lib/audio";
import * as Haptics from "@/lib/haptics";
import { SymbolView } from "@/lib/icon";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import Colors from "@/constants/colors";
import { HelpTip } from "@/components/HelpTip";

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, durationSeconds: number) => Promise<void>;
  isUploading?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, isUploading }: VoiceRecorderProps) {
  const scheme = useColorScheme() ?? "light";
  const C = Colors[scheme];
  const isIOS = Platform.OS === "ios";

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<InstanceType<typeof Audio.Recording> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setHasPermission(true);
      return true;
    }
    try {
      const { Audio } = await import("@/lib/audio");
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === "granted";
      setHasPermission(granted);
      if (!granted) {
        Alert.alert(
          "Microphone Access",
          "Please allow microphone access in Settings to record voice notes."
        );
      }
      return granted;
    } catch {
      return false;
    }
  };

  const startRecording = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Recording not available in web preview.");
      return;
    }

    const allowed = hasPermission ?? (await requestPermission());
    if (!allowed) return;

    try {
      const { Audio } = await import("@/lib/audio");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      startTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    stopTimer();
    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const { Audio } = await import("@/lib/audio");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      const duration = elapsed;
      recordingRef.current = null;
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onRecordingComplete(uri, duration);
      }
    } catch {
      Alert.alert("Error", "Could not save recording.");
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: C.textSecondary }]}>Voice Recording</Text>
        <HelpTip
          title="Voice Notes"
          description="Tap Record Note to capture your observations at this property. Your recording is transcribed automatically and included in the AI summary at the end of the tour. Works offline — recordings upload when you regain signal."
        />
      </View>
      <Pressable
        testID="voice-record-btn"
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isUploading}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: isRecording ? C.coral : C.accent,
          },
          (pressed || isUploading) && { opacity: 0.7 },
        ]}
      >
        {isUploading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : isIOS ? (
          <SymbolView
            name={isRecording ? "stop.circle.fill" : "mic.fill"}
            tintColor="#FFF"
            size={20}
          />
        ) : (
          <Feather name={isRecording ? "square" : "mic"} size={20} color="#FFF" />
        )}
        <Text style={styles.btnLabel}>
          {isUploading ? "Uploading…" : isRecording ? `Stop  ${formatTime(elapsed)}` : "Record Note"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnLabel: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
