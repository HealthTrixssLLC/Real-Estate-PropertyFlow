import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";

const QUEUE_KEY = "voice_upload_queue";

export interface PendingUpload {
  id: string;
  uri: string;
  tourStopId: string;
  durationSeconds: number;
  createdAt: number;
  retryCount: number;
}

export async function enqueueVoiceUpload(
  uri: string,
  tourStopId: string,
  durationSeconds: number
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: PendingUpload = {
    id,
    uri,
    tourStopId,
    durationSeconds,
    createdAt: Date.now(),
    retryCount: 0,
  };
  const existing = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, item]));
  return id;
}

export async function getQueue(): Promise<PendingUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const existing = await getQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(existing.filter((i) => i.id !== id))
  );
}

export async function incrementRetry(id: string): Promise<void> {
  const existing = await getQueue();
  const updated = existing.map((i) =>
    i.id === id ? { ...i, retryCount: i.retryCount + 1 } : i
  );
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function getPendingCount(): Promise<number> {
  const q = await getQueue();
  return q.length;
}

async function uploadItem(item: PendingUpload): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const FileSystem = await import("expo-file-system");
    const base64 = await FileSystem.readAsStringAsync(item.uri, {
      encoding: "base64" as const,
    });
    const blob = await fetch(`data:audio/m4a;base64,${base64}`).then((r) =>
      r.blob()
    );
    const { uploadVoiceNote } = await import("@workspace/api-client-react");
    await uploadVoiceNote({
      tourStopId: item.tourStopId,
      audio: blob,
      durationSeconds: item.durationSeconds,
    });
    return true;
  } catch {
    return false;
  }
}

export async function flushQueue(): Promise<number> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return 0;

  const queue = await getQueue();
  if (queue.length === 0) return 0;

  let successCount = 0;
  for (const item of queue) {
    if (item.retryCount >= 5) {
      await removeFromQueue(item.id);
      continue;
    }
    const ok = await uploadItem(item);
    if (ok) {
      await removeFromQueue(item.id);
      successCount++;
    } else {
      await incrementRetry(item.id);
    }
  }
  return successCount;
}

export async function tryImmediateUpload(
  uri: string,
  tourStopId: string,
  durationSeconds: number,
  onQueued?: () => void
): Promise<"uploaded" | "queued" | "error"> {
  if (Platform.OS === "web") return "error";

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    await enqueueVoiceUpload(uri, tourStopId, durationSeconds);
    onQueued?.();
    return "queued";
  }

  try {
    const FileSystem = await import("expo-file-system");
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as const,
    });
    const blob = await fetch(`data:audio/m4a;base64,${base64}`).then((r) =>
      r.blob()
    );
    const { uploadVoiceNote } = await import("@workspace/api-client-react");
    await uploadVoiceNote({ tourStopId, audio: blob, durationSeconds });
    return "uploaded";
  } catch {
    await enqueueVoiceUpload(uri, tourStopId, durationSeconds);
    onQueued?.();
    return "queued";
  }
}
