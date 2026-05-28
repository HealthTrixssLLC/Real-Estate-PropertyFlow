import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  OutputFormatAndroidType,
} from "react-native-audio-recorder-player";
import { PermissionsAndroid, Platform } from "react-native";

/**
 * Drop-in shape-compatible replacement for the subset of expo-av used
 * by VoiceRecorder and DebriefSheet. Backed by react-native-audio-recorder-player.
 *
 * Usage parity:
 *   const { Audio } = await import("@/lib/audio");
 *   await Audio.requestPermissionsAsync();
 *   await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
 *   const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
 *   await recording.stopAndUnloadAsync();
 *   const uri = recording.getURI();
 */

class Recording {
  private uri: string | null = null;
  private player: AudioRecorderPlayer;
  private started = false;

  constructor(player: AudioRecorderPlayer) {
    this.player = player;
  }

  async start(options?: RecordingOptions): Promise<string> {
    // Pass `undefined` to let the library pick a platform-appropriate
    // default path (iOS: .m4a in app's temp dir).
    const uri = await this.player.startRecorder(undefined, options?.ios as any);
    this.uri = uri;
    this.started = true;
    return uri;
  }

  async stopAndUnloadAsync(): Promise<void> {
    if (!this.started) return;
    try {
      const uri = await this.player.stopRecorder();
      this.uri = uri;
    } finally {
      this.started = false;
      this.player.removeRecordBackListener();
    }
  }

  getURI(): string | null {
    return this.uri;
  }
}

interface RecordingOptions {
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
}

const HIGH_QUALITY: RecordingOptions = {
  ios: {
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
    AVNumberOfChannelsKeyIOS: 2,
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVSampleRateKeyIOS: 44100,
  },
  android: {
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  },
};

async function requestPermissionsAsync(): Promise<{ status: "granted" | "denied" }> {
  if (Platform.OS === "android") {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return { status: granted === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied" };
    } catch {
      return { status: "denied" };
    }
  }
  // iOS prompts automatically the first time AVAudioSession is activated for
  // recording; Info.plist NSMicrophoneUsageDescription must be set.
  return { status: "granted" };
}

async function setAudioModeAsync(_opts: {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS?: boolean;
  [k: string]: unknown;
}): Promise<void> {
  // The underlying iOS audio session is configured by
  // react-native-audio-recorder-player at start/stop time; this is a no-op
  // shim to satisfy the expo-av call signature used by existing screens.
  return;
}

// Lazy-construct a single shared player per app lifetime; create new
// Recording wrappers per createAsync call so each owns its own uri state.
let _player: AudioRecorderPlayer | null = null;
function getPlayer(): AudioRecorderPlayer {
  if (!_player) _player = new AudioRecorderPlayer();
  return _player;
}

async function createAsync(options: RecordingOptions = HIGH_QUALITY) {
  const recording = new Recording(getPlayer());
  await recording.start(options);
  return { recording };
}

export const Audio = {
  Recording: { createAsync },
  RecordingOptionsPresets: { HIGH_QUALITY },
  requestPermissionsAsync,
  setAudioModeAsync,
};

// Some callers do `type { Audio } from "@/lib/audio"` to get the
// `InstanceType<typeof Audio.Recording>` ref type. Export the class so
// `Audio.Recording` is a constructable type as well as a namespace.
(Audio.Recording as unknown as { prototype: Recording }).prototype = Recording.prototype;

export type { Recording };
export default Audio;
