/**
 * Stand-in for expo-file-system/legacy's readAsStringAsync. The only caller
 * (voiceUploadQueue) immediately converts the base64 result back into a Blob
 * via `fetch("data:audio/m4a;base64," + b64)` — so we just route through
 * `fetch(uri)` directly. RN supports file:// URIs natively and yields a
 * blob without the base64 round-trip.
 */
export async function readAsStringAsync(
  uri: string,
  _opts?: { encoding?: string },
): Promise<string> {
  const r = await fetch(uri);
  const blob = await r.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      // strip "data:audio/m4a;base64," prefix to match the legacy API
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(blob);
  });
}
