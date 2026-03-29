import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "tourflow_pending_notes";

interface PendingNote {
  id: string;
  stopId: string;
  note: string;
  createdAt: string;
}

async function readQueue(): Promise<PendingNote[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingNote[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingNote[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueNote(stopId: string, note: string): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    stopId,
    note,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function getPendingNotes(): Promise<PendingNote[]> {
  return readQueue();
}

export async function flushNoteQueue(
  baseUrl: string,
  getHeaders: () => Record<string, string>
): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;
  const remaining: PendingNote[] = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${baseUrl}/api/tour-stops/${item.stopId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ note: item.note }),
      });
      if (!res.ok) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
}
